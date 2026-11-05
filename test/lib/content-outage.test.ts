import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Outage behaviour of the Phase 3 read path. Split from `content-tiers.test.ts` because these tests
 * assert what a visitor experiences when the bucket cannot serve, which is the fallback question Phase 3
 * was asked to answer. `#lib/s3` is mocked wholesale: what matters is the tier a read resolves to.
 */

let s3Failure: string | "" = "not configured";
let s3Objects = new Map<string, string>();
let s3Calls: string[] = [];

const makeFakeS3 = () => ({
  putObject: ({ Key }: { Key: string }) => {
    s3Calls.push(`put:${Key}`);
    return { promise: async () => ({}) };
  },
  getObject: ({ Key }: { Key: string }) => {
    s3Calls.push(`get:${Key}`);
    if (s3Failure) {
      return {
        promise: async () => {
          throw Object.assign(new Error(s3Failure), { code: "NoSuchKey" });
        },
      };
    }
    if (!s3Objects.has(Key)) {
      return {
        promise: async () => {
          throw Object.assign(new Error("NotFound"), { code: "NoSuchKey" });
        },
      };
    }
    return { promise: async () => ({ Body: s3Objects.get(Key) }) };
  },
  headObject: ({ Key }: { Key: string }) => {
    s3Calls.push(`head:${Key}`);
    return { promise: async () => ({}) };
  },
});

vi.mock("#lib/s3", () => ({
  initS3: vi.fn(),
  getS3Client: () => makeFakeS3(),
  getOptionalS3Bucket: () => (s3Failure ? undefined : "test-bucket"),
  getS3File: vi.fn(),
  uploadS3File: vi.fn(),
  deleteS3File: vi.fn(),
}));

const loadContent = async (liveSource?: string) => {
  if (liveSource === undefined) {
    delete process.env.CONTENT_LIVE_SOURCE;
  } else {
    process.env.CONTENT_LIVE_SOURCE = liveSource;
  }

  vi.resetModules();

  return await import("#lib/content.server");
};

beforeEach(() => {
  s3Failure = "not configured";
  s3Objects = new Map();
  s3Calls = [];
});

afterEach(() => {
  delete process.env.CONTENT_LIVE_SOURCE;
});

describe("content read path under an S3 outage", () => {
  it("resolves a bundled read without contacting S3 at all", async () => {
    const content = await loadContent("s3");
    const store = content.contentDataStore();

    const layout = JSON.parse(await store.readFile("layout", "bundled"));

    expect(layout.name).toBe("layout");
    // The immunity claim: a pinned key never enters the network path, so an outage cannot reach it.
    expect(s3Calls).toEqual([]);
  });

  it("falls back to the bundled payload when a live read fails", async () => {
    const content = await loadContent("s3");
    const store = content.contentDataStore();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    s3Failure = "The bucket is unreachable.";

    const poems = JSON.parse(await store.readFile("poems", "live"));

    expect(poems.name).toBe("poems");
    // A silent fallback would hide a real outage, so the failure must be logged.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("serves the released S3 copy when the bucket is reachable", async () => {
    const content = await loadContent("s3");
    const store = content.contentDataStore();

    s3Failure = "";
    s3Objects.set(
      "data/live/poems.json",
      '{"name":"poems","timestamp":2,"data":[]}',
    );

    const poems = JSON.parse(await store.readFile("poems", "live"));

    expect(poems.timestamp).toBe(2);
  });

  it("never degrades a draft read to the bundled payload", async () => {
    const content = await loadContent("s3");
    const store = content.contentDataStore();

    s3Failure = "The bucket is unreachable.";

    // An editor must not be handed a stale repo copy it could then save back over real work.
    await expect(store.readFile("poems", "draft")).rejects.toThrow();
  });

  it("keeps every bundled-tier key readable when the bucket is down", async () => {
    const content = await loadContent("s3");
    const store = content.contentDataStore();

    s3Failure = "The bucket is unreachable.";

    // The site-wide answer to the fallback question: the shell survives, so the site is not unusable.
    for (const key of content.BUNDLED_CONTENT_KEYS) {
      const parsed = JSON.parse(await store.readFile(key, "bundled"));

      expect(parsed.name).toBe(key);
    }
  });
});

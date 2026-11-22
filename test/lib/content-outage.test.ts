import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Outage behaviour of the Phase 3 read path. Split from `content-tiers.test.ts` because these tests
 * assert what a visitor experiences when the bucket cannot serve, which is the fallback question Phase 3
 * was asked to answer. `#lib/s3` is mocked wholesale: what matters is the tier a read resolves to.
 */

let s3Failure: string | "" = "not configured";
let s3Objects = new Map<string, string>();
let s3Calls: string[] = [];
let liveSourceValue: string | undefined;
let livePrefixValue: string | undefined;

/**
 * Same reason as in `content-tiers.test.ts`: the flag arrives through `$app/env/private`, whose values Kit
 * publishes from the local env files. Left unmocked, an outage test would resolve whatever tier the
 * developer's `.env.local` happens to name. Kit's env module - not `process.env` - is where private
 * variables actually live, which is what the last test in this file is for.
 */
vi.mock("$app/env/private", () => ({
  get CONTENT_LIVE_SOURCE() {
    return liveSourceValue;
  },
  get ENABLE_CONTENT_EDITOR() {
    return undefined;
  },
  get CONTENT_S3_PREFIX() {
    return livePrefixValue;
  },
}));

/**
 * v3 client double. aws-sdk v2 exposed `getObject`/`putObject`/`headObject` returning a `{ promise }`
 * envelope; v3 has one entry point, `send(command)`, which returns a promise directly and hands back
 * the command's `input`. The double therefore dispatches on the command type so the existing call
 * recording (`s3Calls`) still describes which key each operation targeted.
 */
const makeFakeS3 = () => ({
  send: async (command: {
    input: { Key?: string; Bucket?: string };
    constructor: { name: string };
  }) => {
    const Key = command.input.Key ?? "";
    const name = command.constructor.name;

    if (name === "PutObjectCommand") {
      s3Calls.push(`put:${Key}`);
      return {};
    }

    if (name === "GetObjectCommand") {
      s3Calls.push(`get:${Key}`);

      if (s3Failure) {
        throw Object.assign(new Error(s3Failure), { name: "NoSuchKey" });
      }
      if (!s3Objects.has(Key)) {
        throw Object.assign(new Error("NotFound"), { name: "NoSuchKey" });
      }
      return { Body: s3Objects.get(Key) };
    }

    if (name === "HeadObjectCommand") {
      s3Calls.push(`head:${Key}`);
      return {};
    }

    throw new Error(`Unexpected command sent by the data store: ${name}`);
  },
});

vi.mock("#lib/s3", () => ({
  initS3: vi.fn(),
  getS3Client: () => makeFakeS3(),
  getOptionalS3Bucket: () => (s3Failure ? undefined : "test-bucket"),
  getS3File: vi.fn(),
  uploadS3File: vi.fn(),
  deleteS3File: vi.fn(),
  // The store normalizes an object body through this helper, so the double must expose it. Bodies in this
  // suite are plain strings; the streamed shapes a real client hands over are asserted against the real
  // helper in `s3.test.ts` and through the store in `dataStore.s3.test.ts`.
  s3BodyToString: async (body: unknown) => String(body),
}));

const loadContent = async (liveSource?: string, prefix?: string) => {
  liveSourceValue = liveSource;
  livePrefixValue = prefix;

  vi.resetModules();

  return await import("#lib/content.server");
};

beforeEach(() => {
  s3Failure = "not configured";
  s3Objects = new Map();
  s3Calls = [];
});

afterEach(() => {
  liveSourceValue = undefined;
  livePrefixValue = undefined;
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

  describe("the prefix content is read and written under", () => {
    it("names data when nothing is configured, because production has never had a prefix", async () => {
      const content = await loadContent("s3");

      // `npm run seed:s3` writes `data/...` and production has never set a prefix. If this default moved,
      // every object already in the bucket would become a read the app no longer makes, and the site would
      // serve bundled payloads while a bucket full of releases sat unused.
      expect(content.contentS3Prefix()).toBe("data");
    });

    it("asks only its own key when a different prefix is configured", async () => {
      const content = await loadContent("s3", "dev-data");

      expect(content.contentS3Prefix()).toBe("dev-data");
    });

    it("answers a dev-prefix miss from the repo copy, not from the object one prefix away", async () => {
      const content = await loadContent("s3", "dev-data");
      const store = content.contentDataStore();

      s3Failure = "";
      s3Objects.set(
        "data/live/poems.json",
        '{"name":"poems","timestamp":9,"data":[{"id":"prod-only-object"}]}',
      );

      const parsed = JSON.parse(await store.readFile("poems", "live"));

      // The two halves of the same guard: the dev run asks for its own key and nothing else, and the miss it
      // comes back with is answered from the repo copy. Serving production's copy to a dev server is how a
      // dev edit ends up saved back over the site's own released content.
      expect(s3Calls).toEqual(["get:dev-data/live/poems.json"]);
      expect(JSON.stringify(parsed)).not.toContain("prod-only-object");
      expect(parsed.name).toBe("poems");
    });

    it("reads the dev copy when the dev prefix is the one that holds a release", async () => {
      const content = await loadContent("s3", "dev-data");
      const store = content.contentDataStore();

      s3Failure = "";
      s3Objects.set(
        "dev-data/live/poems.json",
        '{"name":"poems","timestamp":7,"data":[]}',
      );
      s3Objects.set(
        "data/live/poems.json",
        '{"name":"poems","timestamp":9,"data":[]}',
      );

      const poems = JSON.parse(await store.readFile("poems", "live"));

      expect(poems.timestamp).toBe(7);
      expect(s3Calls).toEqual(["get:dev-data/live/poems.json"]);
    });
  });

  it("turns the tier on through the private env module rather than process.env", async () => {
    // The defect that made a seeded bucket serve nothing. `isLiveContentFromS3` read `process.env`, and
    // SvelteKit 3 confines private variables to `$app/env/private`: the switch was measured in the dev
    // server as `process.env.CONTENT_LIVE_SOURCE === undefined` while `$app/env/private` reported "s3".
    //
    // Mocking the private module does not catch that read on its own, and neither does the runner - Vitest
    // leaves `process.env.CONTENT_LIVE_SOURCE` undefined, so a `process.env` version of the line stayed
    // invisible to every other test in this file while the site it described served the filesystem tier.
    // The two sources are made to disagree here on purpose, and the fake bucket is left configured so the
    // disk store cannot be chosen merely because the bucket is unusable.
    s3Failure = "";
    process.env.CONTENT_LIVE_SOURCE = "s3";

    try {
      const content = await loadContent();
      const { fsDataStore } = await import("#lib/dataStore.server");

      // The flag read itself: while the private module says live content is not in S3, a public read of an
      // S3-eligible key resolves to the bundled tier whatever `process.env` claims.
      expect(content.publicReadScope("poems")).toBe("bundled");
      expect(content.contentDataStore()).toBe(fsDataStore);
      // The consequence, read through the fake client: not one key was asked of a bucket that was ready.
      expect(s3Calls).toEqual([]);
    } finally {
      delete process.env.CONTENT_LIVE_SOURCE;
    }
  });
});

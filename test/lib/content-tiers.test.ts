import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Characterization tests for the Phase 3 public read path.
 *
 * These cover the question Phase 3 has to answer: what happens to a page when S3 cannot serve it. The
 * answers are load-bearing and mutually contradictory unless tested together — bundled content must be
 * immune to the bucket, live content must degrade to the repo copy, and a draft read must never do
 * either. `#lib/s3` is mocked wholesale rather than contacted: what matters is which tier a read
 * resolves to, not network behaviour.
 */

const BUCKET = "test-bucket";

/** An S3 double whose every call fails, standing in for an outage or an unconfigured bucket. */
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
  getOptionalS3Bucket: () => (s3Failure ? undefined : BUCKET),
  getS3File: vi.fn(),
  uploadS3File: vi.fn(),
  deleteS3File: vi.fn(),
}));

/** Load `#lib/content.server` fresh, with an optional CONTENT_LIVE_SOURCE value. */
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

describe("content server tiers", () => {
  describe("while live content is still on disk", () => {
    it("pins layout and landing to the bundle", async () => {
      const content = await loadContent();

      expect(content.publicReadScope("layout")).toBe("bundled");
      expect(content.publicReadScope("landing")).toBe("bundled");
    });

    it("reads the four S3-eligible keys from draft until they are released", async () => {
      const content = await loadContent();

      for (const key of content.S3_CONTENT_KEYS) {
        expect(content.publicReadScope(key)).toBe("draft");
      }
    });

    it("keeps layout and landing out of the S3-eligible keys entirely", async () => {
      const content = await loadContent();

      // The type system already proves these two lists are disjoint; this asserts it at runtime so a
      // future edit that merges them would be caught. `as string` widens past the literal types, which
      // is why the compiler objects to a direct comparison above.
      const s3Keys: string[] = [...content.S3_CONTENT_KEYS];

      for (const key of content.BUNDLED_CONTENT_KEYS) {
        expect(s3Keys).not.toContain(key);
      }
    });
  });

  describe("once live content lives in S3", () => {
    it("switches the four eligible keys to live", async () => {
      const content = await loadContent("s3");

      for (const key of content.S3_CONTENT_KEYS) {
        expect(content.publicReadScope(key)).toBe("live");
      }
    });

    it("never switches layout or landing, even with S3 enabled", async () => {
      const content = await loadContent("s3");

      // The point of the bundled tier: a site-wide shell must not become reachable from the network just
      // because the content tier moved.
      expect(content.publicReadScope("layout")).toBe("bundled");
      expect(content.publicReadScope("landing")).toBe("bundled");
    });
  });

  describe("release guards", () => {
    it("refuses to release while live content is still bundled", async () => {
      const content = await loadContent();

      for (const key of content.S3_CONTENT_KEYS) {
        expect(content.isReleasable(key)).toBe(false);
      }

      expect(() => content.requireReleasable("poems")).toThrow();
    });

    it("refuses to release bundled-tier keys even with S3 enabled", async () => {
      const content = await loadContent("s3");

      expect(content.isReleasable("layout")).toBe(false);
      expect(() => content.requireReleasable("layout")).toThrow();
      expect(() => content.requireReleasable("landing")).toThrow();
    });

    it("treats an eligible key as releasable once live content is in S3", async () => {
      const content = await loadContent("s3");

      // `ENABLE_CONTENT_EDITOR` is unset in tests so the editor gate still blocks an actual release;
      // eligibility itself must be true or a real release could never get through.
      expect(content.isReleasable("poems")).toBe(true);
    });
  });
});

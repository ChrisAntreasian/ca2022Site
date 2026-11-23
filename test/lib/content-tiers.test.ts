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
let liveSourceValue: string | undefined;

/**
 * `CONTENT_LIVE_SOURCE` is read from `$app/env/private` (Kit 3), not from `process.env`. Vitest loads
 * `.env.local` the way any other Vite run does, so the real env module would hand these tests whatever the
 * author happens to have set locally and every tier assertion would drift with it. Mocking the module with
 * live getters puts the value under each test's control.
 */
vi.mock("$app/env/private", () => ({
  get CONTENT_LIVE_SOURCE() {
    return liveSourceValue;
  },
  get CONTENT_S3_PREFIX() {
    // Left unset here on purpose: these tests assert which *tier* a read resolves to, and the prefix that
    // tier hangs under is asserted where a bucket is actually reached - `content-outage.test.ts`. Returning
    // undefined is what a production deploy that configures no prefix reports, so these tests keep using the
    // layout `npm run seed:s3` writes.
    return undefined;
  },
  get CONTENT_LOCAL_MIRROR() {
    // Left unset on purpose: these tests assert which tier a read resolves to, and the write mirror only
    // exists on the write side of the seam. `dataStore.mirror.test.ts` is where that switch is asserted.
    return undefined;
  },
  get ENABLE_CONTENT_EDITOR() {
    return undefined;
  },
}));

/** An S3 double whose every call fails, standing in for an outage or an unconfigured bucket. */

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
  // The store hands every object body to this helper. A string-shaped stand-in is enough for a suite that
  // only asks which tier a read resolves to, and the shapes a real client produces are asserted where the
  // module is real - in `s3.test.ts` and `dataStore.s3.test.ts`.
  s3BodyToString: async (body: unknown) => String(body),
}));

/** Load `#lib/content.server` fresh, with an optional CONTENT_LIVE_SOURCE value. */
const loadContent = async (liveSource?: string) => {
  liveSourceValue = liveSource;

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
});

describe("content server tiers", () => {
  describe("while live content is still on disk", () => {
    it("pins layout and landing to the bundle", async () => {
      const content = await loadContent();

      expect(content.publicReadScope("layout")).toBe("bundled");
      expect(content.publicReadScope("landing")).toBe("bundled");
    });

    it("reads the four S3-eligible keys from the bundle until they are released", async () => {
      const content = await loadContent();

      // A public read must never resolve to a draft: `src/data/draft/` only exists once an editor has
      // saved or a seed has run, so resolving here would ENOENT on a fresh checkout. The bundle is the
      // payload the build actually ships, and it is what a visitor sees until a release lands in S3.
      for (const key of content.S3_CONTENT_KEYS) {
        expect(content.publicReadScope(key)).toBe("bundled");
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

    it("switches layout and landing to live too, so the shell can be S3-driven", async () => {
      const content = await loadContent("s3");

      // The CMS goal: a non-dev should be able to publish nav/home changes into S3 without a git push.
      // With the flag on, layout and landing resolve to the live tier like every other key. They stay out
      // of S3_CONTENT_KEYS (no editor releases them), but publicReadScope still routes them to "live" -
      // createS3DataStore then falls back to their bundled payload on any bucket failure (see content-outage).
      expect(content.publicReadScope("layout")).toBe("live");
      expect(content.publicReadScope("landing")).toBe("live");
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

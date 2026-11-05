import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createS3DataStore,
  seedFromBundledData,
  type DataStore,
} from "#lib/dataStore.server";

/**
 * Characterization tests for the S3 store.
 *
 * `#lib/s3` is mocked wholesale rather than exercised against a live bucket: what matters here is
 * which key each operation targets and the order they land in, because those are what a draft/live
 * migration can get wrong while every payload still looks correct. `s3.test.ts` covers the client.
 */

const BUCKET = "test-bucket";

const makeFakeS3 = (seed: Record<string, string>) => {
  const calls: Array<{ op: string; key: string; body?: unknown }> = [];
  const store = new Map(Object.entries(seed));

  const fake = {
    putObject: ({ Key, Body }: { Key: string; Body?: unknown }) => {
      calls.push({ op: "put", key: Key, body: Body });
      store.set(Key, String(Body));
      return { promise: async () => ({}) };
    },
    getObject: ({ Key }: { Key: string }) => {
      calls.push({ op: "get", key: Key });
      if (!store.has(Key)) {
        return {
          promise: async () => {
            throw Object.assign(new Error("NotFound"), { code: "NoSuchKey" });
          },
        };
      }
      return { promise: async () => ({ Body: store.get(Key) }) };
    },
    headObject: ({ Key }: { Key: string }) => {
      calls.push({ op: "head", key: Key });
      if (!store.has(Key)) {
        return {
          promise: async () => {
            throw Object.assign(new Error("NotFound"), { code: "NotFound" });
          },
        };
      }
      return { promise: async () => ({}) };
    },
  };

  return { fake, calls, store };
};

// Rebuilt per test so a release can be read back as an ordered sequence of key writes.
let harness = makeFakeS3({});

vi.mock("#lib/s3", () => ({
  initS3: vi.fn(),
  getS3Client: () => harness.fake,
  getOptionalS3Bucket: () => BUCKET,
  getS3File: vi.fn(),
  uploadS3File: vi.fn(),
  deleteS3File: vi.fn(),
}));

const makeStore = (options?: {
  prefix?: string;
  fallbacks?: Record<string, string>;
}): DataStore => createS3DataStore(options);

beforeEach(() => {
  harness = makeFakeS3({});
});

describe("s3DataStore", () => {
  describe("key layout", () => {
    it("writes draft to data/draft/<name>.json with a history snapshot first", async () => {
      const file = { name: "poems", timestamp: 111, data: { a: 1 } };

      await makeStore().writeFile("poems", file);

      expect(harness.calls.map((c) => c.key)).toEqual([
        "data/history/draft/poems/111.json",
        "data/draft/poems.json",
      ]);
    });

    it("writes live to data/live/<name>.json when asked", async () => {
      const file = { name: "poems", timestamp: 222, data: [] };

      await makeStore().writeFile("poems", file, "live");

      expect(harness.calls.map((c) => c.key)).toEqual([
        "data/history/live/poems/222.json",
        "data/live/poems.json",
      ]);
    });

    it("honours a custom prefix across all three tiers", async () => {
      const store = makeStore({ prefix: "site-data" });

      await store.writeFile(
        "landing",
        { name: "landing", timestamp: 1, data: {} },
        "live",
      );
      await store.readFile("landing", "live");

      expect(harness.calls.map((c) => c.key)).toEqual([
        "site-data/history/live/landing/1.json",
        "site-data/live/landing.json",
        "site-data/live/landing.json",
      ]);
    });

    it("serializes byte-identically to the fs store", async () => {
      const file = { name: "poems", timestamp: 333, data: { a: 1 } };

      await makeStore().writeFile("poems", file);

      expect(harness.calls[0].body).toBe(`${JSON.stringify(file, null, 2)}\n`);
    });
  });

  describe("readFile", () => {
    it("reads the scoped key", async () => {
      harness = makeFakeS3({ "data/live/poems.json": '{"name":"poems"}' });

      const out = await makeStore().readFile("poems", "live");

      expect(out).toBe('{"name":"poems"}');
      expect(harness.calls[0].key).toBe("data/live/poems.json");
    });

    it("never serves a draft when a live read is asked for and live is missing", async () => {
      harness = makeFakeS3({ "data/draft/poems.json": '{"draft":true}' });

      await expect(makeStore().readFile("poems", "live")).rejects.toThrow();
    });

    it("falls back to the bundled payload only for a live read", async () => {
      const store = makeStore({ fallbacks: { poems: '{"bundled":true}' } });

      await expect(store.readFile("poems", "live")).resolves.toBe(
        '{"bundled":true}',
      );
      // A draft miss must stay an error: silently substituting a stale payload would let an editor
      // save it straight back over the real one.
      await expect(store.readFile("poems")).rejects.toThrow();
    });

    it("throws rather than falling back when no fallback is registered", async () => {
      await expect(makeStore().readFile("poems", "live")).rejects.toThrow();
    });
  });

  describe("ensureBaselineSnapshot", () => {
    it("copies the draft into history under its own timestamp", async () => {
      harness = makeFakeS3({
        "data/draft/poems.json": JSON.stringify({
          name: "poems",
          timestamp: 123,
          data: { old: true },
        }),
      });

      const created = await makeStore().ensureBaselineSnapshot("poems");

      expect(created).toBe(true);
      expect(harness.store.has("data/history/draft/poems/123.json")).toBe(true);
    });

    it("skips when the history key already exists", async () => {
      harness = makeFakeS3({
        "data/draft/poems.json": JSON.stringify({ timestamp: 123 }),
        "data/history/draft/poems/123.json": '{"timestamp":123}',
      });

      const created = await makeStore().ensureBaselineSnapshot("poems");

      expect(created).toBe(false);
    });

    it("skips when the current key has no numeric timestamp", async () => {
      harness = makeFakeS3({ "data/draft/poems.json": "{}" });

      const created = await makeStore().ensureBaselineSnapshot("poems");

      expect(created).toBe(false);
      expect(harness.calls.map((c) => c.op)).toEqual(["get"]);
    });

    it("resolves false when the current key is missing", async () => {
      await expect(makeStore().ensureBaselineSnapshot("poems")).resolves.toBe(
        false,
      );
    });
  });

  describe("release", () => {
    const draftOf = (timestamp: number) => ({
      "data/draft/poems.json": JSON.stringify(
        { name: "poems", timestamp, data: { live: true } },
        null,
        2,
      ),
    });

    it("snapshots the outgoing live version before overwriting it", async () => {
      harness = makeFakeS3({
        ...draftOf(300),
        "data/live/poems.json": JSON.stringify(
          { name: "poems", timestamp: 100, data: { old: true } },
          null,
          2,
        ),
      });

      const releasedAt = await makeStore().release("poems");

      expect(releasedAt).toBe(300);
      expect(harness.calls.map((c) => c.key)).toEqual([
        "data/draft/poems.json",
        "data/live/poems.json",
        "data/history/live/poems/100.json",
        "data/live/poems.json",
      ]);

      // The retired version stays recoverable, and live now carries the released one.
      expect(
        JSON.parse(harness.store.get("data/history/live/poems/100.json")!),
      ).toMatchObject({ timestamp: 100 });
      expect(
        JSON.parse(harness.store.get("data/live/poems.json")!),
      ).toMatchObject({ timestamp: 300 });
    });

    it("releases straight to live when nothing has been released before", async () => {
      harness = makeFakeS3(draftOf(400));

      await expect(makeStore().release("poems")).resolves.toBe(400);
      expect(harness.calls.map((c) => c.key)).toEqual([
        "data/draft/poems.json",
        "data/live/poems.json",
        "data/live/poems.json",
      ]);
    });

    it("refuses to release a draft with no numeric timestamp, leaving live untouched", async () => {
      harness = makeFakeS3({
        "data/draft/poems.json": '{"name":"poems"}',
        "data/live/poems.json": JSON.stringify({ name: "poems", timestamp: 1 }),
      });

      await expect(() => makeStore().release("poems")).rejects.toThrow();
      expect(
        JSON.parse(harness.store.get("data/live/poems.json")!),
      ).toMatchObject({ timestamp: 1 });
    });

    it("leaves the draft in place after releasing", async () => {
      harness = makeFakeS3(draftOf(600));

      await makeStore().release("poems");

      expect(harness.store.has("data/draft/poems.json")).toBe(true);
      const draftWrites = harness.calls.filter(
        (c) => c.op === "put" && c.key.includes("draft"),
      );
      expect(draftWrites).toHaveLength(0);
    });
  });

  describe("seedFromBundledData", () => {
    it("writes each bundled key into both draft and live", async () => {
      await seedFromBundledData(makeStore(), ["landing"]);

      const seeded = harness.calls.filter((c) => c.op === "put");
      const targets = seeded
        .map((c) => c.key)
        .filter((k) => !k.includes("history"));

      expect(targets).toEqual([
        "data/draft/landing.json",
        "data/live/landing.json",
      ]);
    });

    it("leaves an existing target alone so a re-run cannot clobber it", async () => {
      const store = makeStore();
      await store.writeFile(
        "landing",
        { name: "landing", timestamp: 1, data: "first" },
        "draft",
      );
      harness.calls.length = 0;

      const results = await seedFromBundledData(store, ["landing"]);

      expect(results.some((r) => r.status === "already present")).toBe(true);
    });

    it("reports a missing bundled file instead of failing the whole run", async () => {
      const results = await seedFromBundledData(makeStore(), [
        "definitely-not-a-content-key",
      ]);

      expect(results.every((r) => r.status === "no bundled file")).toBe(true);
      expect(harness.calls).toHaveLength(0);
    });
  });
});

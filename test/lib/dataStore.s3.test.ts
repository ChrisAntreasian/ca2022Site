import { describe, it, expect, vi, beforeEach } from "vitest";
import { isHttpError } from "@sveltejs/kit";

import {
  createS3DataStore,
  isMissingSnapshot,
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

/**
 * v3 client double. aws-sdk v2 exposed `getObject`/`putObject`/`headObject` returning a `{ promise }`
 * envelope; v3 has one entry point, `send(command)`, returning a promise directly and carrying the
 * request on `command.input`. The double dispatches on command type so the call/order assertions below
 * still describe which key each operation targeted — those ordering guarantees are what a draft/live
 * migration can get wrong while every payload still looks correct.
 */
const makeFakeS3 = (
  seed: Record<string, string>,
  options: {
    streamBodies?: boolean;
    /**
     * Pages a listing hands back one at a time, so a test can prove the store follows the listing's own
     * pagination instead of treating the first thousand keys as the whole of a history.
     */
    listPages?: string[][];
    /** An outage double: every read fails this way, whatever the key.
     */
    getObjectError?: Error;
  } = {},
) => {
  const calls: Array<{ op: string; key: string; body?: unknown }> = [];
  const store = new Map(Object.entries(seed));

  const fake = {
    send: async (command: {
      input: {
        Key?: string;
        Bucket?: string;
        Body?: unknown;
        Prefix?: string;
        ContinuationToken?: string;
      };
      constructor: { name: string };
    }) => {
      const Key = command.input.Key ?? "";
      const name = command.constructor.name;

      if (name === "PutObjectCommand") {
        calls.push({ op: "put", key: Key, body: command.input.Body });
        store.set(Key, String(command.input.Body));
        return {};
      }

      if (name === "GetObjectCommand") {
        calls.push({ op: "get", key: Key });

        if (options.getObjectError) {
          throw options.getObjectError;
        }
        if (!store.has(Key)) {
          // Mirror the v3 error surface the store classifies on: real `NoSuchKey` carries both a `name`
          // and a `code`, so the fake must too rather than relying on one channel.
          throw Object.assign(new Error("NotFound"), {
            name: "NoSuchKey",
            code: "NoSuchKey",
            $metadata: { httpStatusCode: 404 },
          });
        }
        return {
          Body: options.streamBodies
            ? checksumStreamBody(store.get(Key) ?? "")
            : store.get(Key),
        };
      }

      if (name === "HeadObjectCommand") {
        calls.push({ op: "head", key: Key });
        if (!store.has(Key)) {
          // A HEAD on a missing key reports 404/NotFound in v3, not `NoSuchKey` — the fake reflects that
          // so the store's identity-based classification is exercised through both channels.
          throw Object.assign(new Error("NotFound"), {
            name: "NotFound",
            code: "NotFound",
            $metadata: { httpStatusCode: 404 },
          });
        }
        return {};
      }

      if (name === "ListObjectsV2Command") {
        const Prefix = command.input.Prefix ?? "";
        calls.push({ op: "list", key: Prefix });

        const pages = options.listPages;

        if (pages) {
          const page = Number(command.input.ContinuationToken ?? 0);
          const more = page + 1 < pages.length;

          return {
            Contents: (pages[page] ?? []).map((key) => ({ Key: key })),
            IsTruncated: more,
            NextContinuationToken: more ? String(page + 1) : undefined,
          };
        }

        return {
          Contents: [...store.keys()]
            .filter((key) => key.startsWith(Prefix))
            .map((Key) => ({ Key })),
          IsTruncated: false,
        };
      }

      throw new Error(`Unexpected command sent by the data store: ${name}`);
    },
  };

  return { fake, calls, store };
};

// Rebuilt per test so a release can be read back as an ordered sequence of key writes.
let harness = makeFakeS3({});

/**
 * The body aws-sdk v3 actually hands a Node client for `GetObject`: a `ChecksumStream`, which the SDK's
 * stream mixin gives `transformToString` and which inherits its async iterator from `Readable`. It is
 * nothing string-shaped - no `toString`, no `valueOf`, no `Symbol.toStringTag` that a coercion would use.
 *
 * Every other double in this file hands back a plain string, which is exactly how a store whose body
 * normalizer accepted only strings and Buffers passed here while throwing "Unexpected S3 object body" on
 * every read against a real bucket. The accessor is the one the store must prefer: the SDK verifies the
 * object's checksum as it reads through `transformToString`, which a bare iteration loop skips.
 *
 * Built by hand because `node:stream` is unusable in this runner: `resolve.conditions: ["browser"]` makes
 * it resolve to a browser stream polyfill with no `Readable.toReadable`.
 */
class FakeChecksumStream {
  private readonly payload: string;

  constructor(payload: string) {
    this.payload = payload;
  }

  async transformToString() {
    return this.payload;
  }

  async *[Symbol.asyncIterator]() {
    yield Buffer.from(this.payload, "utf8");
  }
}

const checksumStreamBody = (text: string) => new FakeChecksumStream(text);

vi.mock("#lib/s3", async () => {
  // Spread the real module and override only the client accessors. `s3BodyToString` in particular must stay
  // real: the store delegates body-to-text conversion to it, and replacing it here is what would let a
  // store that rejects streamed bodies keep passing this file.
  const actual = await vi.importActual<typeof import("#lib/s3")>("#lib/s3");

  return {
    ...actual,
    initS3: vi.fn(),
    getS3Client: () => harness.fake,
    getOptionalS3Bucket: () => BUCKET,
    getS3File: vi.fn(),
    uploadS3File: vi.fn(),
    deleteS3File: vi.fn(),
  };
});

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

  describe("prefix isolation", () => {
    it("keeps every tier it writes inside the prefix it was given", async () => {
      const store = makeStore({ prefix: "dev-data" });

      await store.writeFile("poems", {
        name: "poems",
        timestamp: 111,
        data: [],
      });
      await store.release("poems");
      await store.listHistory("poems");

      expect(
        harness.calls
          .filter((call) => call.op === "put")
          .map((call) => call.key),
      ).toEqual([
        "dev-data/history/draft/poems/111.json",
        "dev-data/draft/poems.json",
        "dev-data/live/poems.json",
      ]);
      // A saved-versions listing has to stay inside its own prefix as much as a write does. A list that
      // reached across into production's history would put those versions on a dev screen and offer to
      // restore one of them onto a dev draft.
      expect(
        harness.calls
          .filter((call) => call.op === "list")
          .map((call) => call.key),
      ).toEqual(["dev-data/history/"]);
    });

    it("does not read what a different prefix wrote, and does not leave an edit inside production's keys", async () => {
      harness = makeFakeS3({
        "data/draft/poems.json": '{"name":"poems","data":["production"]}',
      });

      const dev = makeStore({ prefix: "dev-data" });

      // The dev server has no draft of its own yet, so it gets nothing - not the copy sitting under the
      // prefix it was told not to use.
      await expect(dev.readFile("poems", "draft")).rejects.toThrow();

      await dev.writeFile("poems", {
        name: "poems",
        timestamp: 222,
        data: ["dev edit"],
      });

      const prod = makeStore();

      await expect(prod.readFile("poems", "draft")).resolves.toBe(
        '{"name":"poems","data":["production"]}',
      );

      const writes = harness.calls
        .filter((call) => call.op === "put")
        .map((call) => call.key);

      // Every write the dev store made is under dev-data. Had the prefix not existed, this is the test whose
      // absence would mean a dev edit had quietly replaced what the site is serving.
      expect(writes).toEqual([
        "dev-data/history/draft/poems/222.json",
        "dev-data/draft/poems.json",
      ]);
    });

    it("still answers a real miss with the bundled copy under a prefix the fallbacks never name", async () => {
      harness = makeFakeS3({
        "data/live/poems.json": '{"production":true}',
      });

      const store = makeStore({
        prefix: "dev-data",
        fallbacks: { poems: '{"bundled":true}' },
      });

      // `fallbacksFor()` is keyed by content key, never by bucket key, so changing the prefix changes which
      // object is missing and nothing about which payload answers the miss. The dev prefix asked for its own
      // live object, found it absent, and was answered from the repo copy - not from the production object
      // that is sitting in the same bucket one prefix over.
      await expect(store.readFile("poems", "live")).resolves.toBe(
        '{"bundled":true}',
      );
      expect(harness.calls.map((call) => call.key)).toEqual([
        "dev-data/live/poems.json",
      ]);
    });

    it("leaves the default prefix alone for a store that was told nothing", async () => {
      const store = makeStore();

      await store.writeFile("poems", {
        name: "poems",
        timestamp: 111,
        data: [],
      });

      // Production has never configured a prefix. If this default moved, every object `npm run seed:s3`
      // already put in the bucket would become a read the app no longer makes.
      expect(
        harness.calls
          .filter((call) => call.op === "put")
          .map((call) => call.key),
      ).toEqual(["data/history/draft/poems/111.json", "data/draft/poems.json"]);
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

    it("reads a body shaped the way aws-sdk hands one in Node", async () => {
      // The gap this closes: every other double in this file hands back a plain string, so a store whose
      // body-to-text step accepted only strings and Buffers could pass here while failing on every read
      // against a real bucket - which is exactly what happened when the S3 flag finally turned on.
      harness = makeFakeS3(
        { "data/draft/poems.json": '{"name":"poems","timestamp":1,"data":[]}' },
        { streamBodies: true },
      );

      const out = await makeStore().readFile("poems", "draft");

      expect(JSON.parse(out)).toEqual({
        name: "poems",
        timestamp: 1,
        data: [],
      });
    });
  });

  describe("saved versions", () => {
    it("lists every tier the bucket holds, newest first", async () => {
      harness = makeFakeS3({
        "data/draft/poems.json": '{"name":"poems"}',
        "data/history/draft/poems/1000.json": "older",
        "data/history/draft/poems/3000.json": "newest",
        "data/history/live/poems/2000.json": "released",
      });

      const entries = await makeStore().listHistory("poems");

      expect(entries).toEqual([
        { timestamp: 3000, scope: "draft" },
        { timestamp: 2000, scope: "live" },
        { timestamp: 1000, scope: "draft" },
      ]);
      // A listing is only a listing. The current draft object sits in the same bucket and does not belong
      // on a screen that offers to restore a version.
      expect(harness.calls.map((call) => call.op)).toEqual(["list"]);
      expect(harness.calls[0]?.key).toBe("data/history/");
    });

    it("orders by the number, not by the key a listing returns", async () => {
      harness = makeFakeS3({
        "data/history/draft/poems/999999999999.json": "a",
        "data/history/draft/poems/1000000000000.json": "b",
      });

      const entries = await makeStore().listHistory("poems");

      // A key sort puts the 13-digit timestamp behind the 12-digit one, which would hand a screen the
      // oldest versions this key has and label them the newest.
      expect(entries.map((entry) => entry.timestamp)).toEqual([
        1000000000000, 999999999999,
      ]);
    });

    it("reports no versions for the legacy tier the bucket never had", async () => {
      harness = makeFakeS3({ "data/history/draft/poems/1000.json": "x" });

      const entries = await makeStore().listHistory("poems", {
        scope: "legacy",
      });

      expect(entries).toEqual([]);
      // Not even a listing, because "there is no legacy prefix in a bucket to list" is the honest answer,
      // and inventing a failure there would look like an outage to a screen that only needed a list.
      expect(harness.calls).toEqual([]);
    });

    it("follows the listing's own pagination instead of trusting one page", async () => {
      harness = makeFakeS3(
        {},
        {
          listPages: [
            [
              "data/history/draft/poems/1.json",
              "data/history/draft/poems/2.json",
            ],
            [
              "data/history/draft/poems/3.json",
              "data/history/live/poems/4.json",
            ],
            ["data/history/draft/poems/5.json"],
          ],
        },
      );

      const entries = await makeStore().listHistory("poems");

      expect(entries.map((entry) => entry.timestamp)).toEqual([5, 4, 3, 2, 1]);
      expect(harness.calls.filter((call) => call.op === "list")).toHaveLength(
        3,
      );
    });

    it("cuts the list only after it has paged through the whole history", async () => {
      harness = makeFakeS3(
        {},
        {
          listPages: [
            [
              "data/history/draft/poems/1.json",
              "data/history/draft/poems/2.json",
            ],
            [
              "data/history/draft/poems/9.json",
              "data/history/draft/poems/8.json",
            ],
          ],
        },
      );

      const entries = await makeStore().listHistory("poems", { limit: 2 });

      // The newest two versions live on the second page. Cutting at the first page instead of after the
      // sort would report 1 and 2 as what this key most recently saved.
      expect(entries.map((entry) => entry.timestamp)).toEqual([9, 8]);
      expect(harness.calls.filter((call) => call.op === "list")).toHaveLength(
        2,
      );
    });

    it("ignores keys that are not this key's snapshots", async () => {
      harness = makeFakeS3({
        "data/history/draft/poems/notes.txt": "a stray note",
        "data/history/draft/poems/01000.json": "padded name",
        "data/history/draft/landing/5.json": "some other key's version",
        "data/history/legacy/poems/7.json": "the flat layout",
        "data/history/draft/poems/2000.json": "a real version",
      });

      const entries = await makeStore().listHistory("poems");

      // The padded name is excluded on purpose: the store reads a version back by rebuilding the key from
      // the number it listed, and a `01000` it cannot rebuild becomes a phantom version on screen.
      expect(entries).toEqual([{ timestamp: 2000, scope: "draft" }]);
    });

    it("reads a draft snapshot back when the caller names no tier", async () => {
      harness = makeFakeS3({
        "data/history/draft/poems/1500.json": "snapshot 1500",
      });

      const text = await makeStore().readHistory("poems", 1500);

      // The editor seam leans on this: a version listed as draft comes back as draft with nothing else for
      // the caller to remember.
      expect(text).toBe("snapshot 1500");
      expect(harness.calls.map((call) => call.key)).toEqual([
        "data/history/draft/poems/1500.json",
      ]);
    });

    it("refuses a missing snapshot instead of answering an empty read", async () => {
      await expect(() =>
        makeStore().readHistory("poems", 3000, "draft"),
      ).rejects.toThrow(
        "No draft snapshot of poems at version 3000 is held in history.",
      );
    });

    it("names a missing snapshot the way the other store would", async () => {
      const cause = await makeStore()
        .readHistory("poems", 3000, "draft")
        .then(
          () => undefined,
          (e: unknown) => e,
        );

      expect(isMissingSnapshot(cause)).toBe(true);
    });

    it("does not report an unreachable bucket as a version that is not there", async () => {
      harness = makeFakeS3(
        {},
        { getObjectError: new Error("the bucket is unreachable") },
      );

      const cause = await makeStore()
        .readHistory("poems", 3000, "draft")
        .then(
          () => undefined,
          (e: unknown) => e,
        );

      // An editor told "that version is gone" while the object still exists and the bucket is merely down
      // is an editor who gives up on a version they could have had back a minute later.
      expect(isMissingSnapshot(cause)).toBe(false);
      expect((cause as Error).message).toBe("the bucket is unreachable");
    });

    it("refuses a legacy version rather than inventing one", async () => {
      harness = makeFakeS3({
        "data/history/draft/poems/1500.json": "a draft copy",
      });

      const cause = await makeStore()
        .readHistory("poems", 1500, "legacy")
        .then(
          () => undefined,
          (e: unknown) => e,
        );

      expect(isMissingSnapshot(cause)).toBe(true);
      // A legacy entry is a local file, never a bucket object. Reading it out of a tier the bucket does
      // hold would answer the caller with a draft copy and call it the old version they asked for.
      expect(harness.calls).toEqual([]);
    });

    it("refuses a version number that is not a real timestamp", async () => {
      const cause = await makeStore()
        .readHistory("poems", 1.5)
        .then(
          () => undefined,
          (e: unknown) => e,
        );

      expect(isHttpError(cause, 500)).toBe(true);
      expect(harness.calls).toEqual([]);
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

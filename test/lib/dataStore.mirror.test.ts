import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  createMirroringDataStore,
  fsDataStore,
  type DataScope,
  type DataStore,
  type HistoryListOptions,
  type ReadScope,
  type SnapshotScope,
} from "#lib/dataStore.server";

import { contentDataStore, isLocalMirrorEnabled } from "#lib/content.server";

/**
 * Characterization tests for the write-only local mirror.
 *
 * The mirror exists for one reason: in S3 mode the bucket holds the only copy of a draft, so a lost
 * bucket means lost editing work. What these tests protect is the two rules that make that safe -
 * every mutation is mirrored *after* the primary's own version of it completes, and the mirror is
 * never read - because both rules are invisible from the outside: a wrapper that broke either one
 * would still return the right payloads and the site would look fine until a save silently replaced a
 * newer real draft with an older local one.
 *
 * The primary is a fake written from `vi.fn()` spies so a test can see which method ran and in what
 * order. The mirror is the real `fsDataStore`, pointed at a throwaway directory with `process.chdir`
 * (every path in that store is relative to the process cwd, so changing the cwd is what "pointed at a
 * tmp directory" means for it), wrapped in a spy layer so a test can count which of its methods the
 * wrapper touched. Disk assertions therefore read real files, not mock call records.
 *
 * The `#lib/s3` and `$app/env/private` mocks belong to the wiring block at the end of this file, which
 * asserts that `contentDataStore()` is the store that applies the wrapper. The unit tests above never
 * construct an S3 store.
 */

const BUCKET = "test-bucket";

let s3Objects = new Map<string, string>();
let s3Calls: string[] = [];
let liveSourceValue: string | undefined;
let localMirrorValue: string | undefined;
let prefixValue: string | undefined;

vi.mock("$app/env/private", () => ({
  get CONTENT_LIVE_SOURCE() {
    return liveSourceValue;
  },
  get CONTENT_LOCAL_MIRROR() {
    return localMirrorValue;
  },
  get CONTENT_S3_PREFIX() {
    return prefixValue;
  },
  get ENABLE_CONTENT_EDITOR() {
    return undefined;
  },
}));

/**
 * A v3-shaped client double: one `send(command)` entry point, dispatching on the command's own class
 * name the way `dataStore.s3.test.ts` does. The commands here are the real aws-sdk classes, so those
 * names are the real ones.
 */
vi.mock("#lib/s3", () => ({
  initS3: vi.fn(),
  getS3Client: () => ({
    send: async (command: {
      constructor: { name: string };
      input: { Key?: string; Body?: unknown; Prefix?: string };
    }) => {
      const name = command.constructor.name;
      const key = command.input.Key ?? "";

      if (name === "PutObjectCommand") {
        s3Calls.push(`put:${key}`);
        s3Objects.set(key, String(command.input.Body));
        return {};
      }

      if (name === "GetObjectCommand") {
        s3Calls.push(`get:${key}`);

        const body = s3Objects.get(key);

        if (body === undefined) {
          throw Object.assign(new Error("NotFound"), { code: "NotFound" });
        }

        return { Body: body };
      }

      if (name === "HeadObjectCommand") {
        s3Calls.push(`head:${key}`);

        if (!s3Objects.has(key)) {
          throw Object.assign(new Error("NotFound"), { code: "NotFound" });
        }

        return {};
      }

      if (name === "ListObjectsV2Command") {
        const prefix = command.input.Prefix ?? "";
        s3Calls.push(`list:${prefix}`);

        return {
          IsTruncated: false,
          Contents: [...s3Objects.keys()]
            .filter((candidate) => candidate.startsWith(prefix))
            .map((Key) => ({ Key })),
        };
      }

      throw new Error(`unexpected S3 command ${name}`);
    },
  }),
  getOptionalS3Bucket: () => BUCKET,
  getS3File: vi.fn(),
  uploadS3File: vi.fn(),
  deleteS3File: vi.fn(),
  s3BodyToString: async (body: unknown) => String(body),
}));

const originalCwd = process.cwd();
let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "ca2022-mirror-"));

  // `fsDataStore` builds every path as `./src/data/...`, so this is the only way to point it somewhere
  // other than the real working copy without touching files a developer is working on.
  process.chdir(sandbox);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(sandbox, { recursive: true, force: true });
  sandbox = "";
  s3Objects = new Map();
  s3Calls = [];
  liveSourceValue = undefined;
  localMirrorValue = undefined;
  prefixValue = undefined;
});

/** Same serializer both stores use, so "the same JSON as the primary's" is a byte-level comparison. */
const jsonText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const localPath = (...segments: string[]) =>
  path.join(sandbox, "src", "data", ...segments);
const readLocal = (...segments: string[]) =>
  fs.readFileSync(localPath(...segments), "utf8");
const writeLocal = (segments: string[], text: string) => {
  const target = localPath(...segments);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const existsLocal = (...segments: string[]) =>
  fs.existsSync(localPath(...segments));

type PrimaryMethod =
  | "readFile"
  | "writeFile"
  | "ensureBaselineSnapshot"
  | "release"
  | "listHistory"
  | "readHistory";

/**
 * A fake primary that stores text under the same key layout the S3 store uses
 * (`draft/poems.json`, `history/draft/poems/100.json`) and records every method it is asked to run into
 * `order`, which is how a test proves the interleaving of the wrapper's two halves.
 */
const makeFakePrimary = (
  options: {
    order: string[];
    seed?: Record<string, string>;
    failures?: Partial<Record<PrimaryMethod, Error>>;
  } = { order: [] },
) => {
  const { order } = options;
  const objects = new Map(Object.entries(options.seed ?? {}));
  const failures = options.failures ?? {};

  const text = (key: string) => {
    const value = objects.get(key);

    if (value === undefined) {
      throw new Error(`primary holds no object at ${key}`);
    }

    return value;
  };

  const draftKey = (name: string, scope: DataScope) => `${scope}/${name}.json`;
  const snapshotKey = (name: string, timestamp: number, scope: DataScope) =>
    `history/${scope}/${name}/${timestamp}.json`;

  const store: DataStore = {
    readFile: vi.fn(async (name: string, scope: ReadScope = "draft") => {
      if (failures.readFile) throw failures.readFile;

      order.push(`primary:readFile:${scope}`);

      return text(
        scope === "bundled" ? `bundled/${name}` : draftKey(name, scope),
      );
    }),

    writeFile: vi.fn(
      async (name: string, file: unknown, scope: DataScope = "draft") => {
        if (failures.writeFile) throw failures.writeFile;

        order.push(`primary:writeFile:${scope}`);

        const json = jsonText(file);
        const timestamp = (file as { timestamp?: number }).timestamp ?? 0;

        objects.set(snapshotKey(name, timestamp, scope), json);
        objects.set(draftKey(name, scope), json);
      },
    ),

    ensureBaselineSnapshot: vi.fn(
      async (name: string, scope: DataScope = "draft") => {
        if (failures.ensureBaselineSnapshot) {
          throw failures.ensureBaselineSnapshot;
        }

        order.push(`primary:ensureBaselineSnapshot:${scope}`);

        const current = objects.get(draftKey(name, scope));

        if (current === undefined) return false;

        const timestamp = (JSON.parse(current) as { timestamp?: unknown })
          .timestamp;

        if (typeof timestamp !== "number") return false;
        if (objects.has(snapshotKey(name, timestamp, scope))) return false;

        objects.set(snapshotKey(name, timestamp, scope), current);

        return true;
      },
    ),

    release: vi.fn(async (name: string) => {
      if (failures.release) throw failures.release;

      order.push("primary:release");

      const draft = text(draftKey(name, "draft"));
      const timestamp = (JSON.parse(draft) as { timestamp?: unknown })
        .timestamp;

      if (typeof timestamp !== "number") {
        throw new Error(`primary cannot release ${name} without a timestamp`);
      }

      const live = objects.get(draftKey(name, "live"));
      const liveTimestamp = live
        ? (JSON.parse(live) as { timestamp?: unknown }).timestamp
        : undefined;

      if (typeof liveTimestamp === "number") {
        objects.set(snapshotKey(name, liveTimestamp, "live"), live as string);
      }

      objects.set(draftKey(name, "live"), `${draft.trimEnd()}\n`);

      return timestamp;
    }),

    listHistory: vi.fn((name: string, options?: HistoryListOptions) => {
      if (failures.listHistory) return Promise.reject(failures.listHistory);

      order.push("primary:listHistory");

      const scope = options?.scope ?? "all";
      const limit = options?.limit ?? 100;
      const entries: { timestamp: number; scope: DataScope }[] = [];

      for (const key of objects.keys()) {
        const match = /^history\/(draft|live)\/([^/]+)\/([1-9]\d*)\.json$/.exec(
          key,
        );

        if (!match || match[2] !== name) continue;
        if (scope !== "all" && scope !== match[1]) continue;

        entries.push({
          timestamp: Number(match[3]),
          scope: match[1] as DataScope,
        });
      }

      // Sorted newest-first and then cut, which is what both real stores do to a history list.
      return Promise.resolve(
        entries
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, Math.max(limit, 0)),
      );
    }),

    readHistory: vi.fn(
      async (
        name: string,
        timestamp: number,
        scope: SnapshotScope = "draft",
      ) => {
        if (failures.readHistory) throw failures.readHistory;

        order.push(`primary:readHistory:${scope}`);

        return Promise.resolve(
          text(`history/${scope}/${name}/${timestamp}.json`),
        );
      },
    ),
  };

  return { store, objects };
};

/**
 * The real `fsDataStore` with a counting shell around it, so a test can say which half of the wrapper
 * ran - including the half that must never run, the mirror's own reads.
 */
const makeMirrorSpy = (order: string[]) => {
  const reads = {
    readFile: vi.fn((name: string, scope: ReadScope = "draft") => {
      order.push(`mirror:readFile:${scope}`);

      return fsDataStore.readFile(name, scope);
    }),
    listHistory: vi.fn((name: string, options?: HistoryListOptions) => {
      order.push("mirror:listHistory");

      return fsDataStore.listHistory(name, options);
    }),
    readHistory: vi.fn(
      (name: string, timestamp: number, scope: SnapshotScope = "draft") => {
        order.push(`mirror:readHistory:${scope}`);

        return fsDataStore.readHistory(name, timestamp, scope);
      },
    ),
  };

  const writes = {
    writeFile: vi.fn(
      async (name: string, file: unknown, scope: DataScope = "draft") => {
        order.push(`mirror:writeFile:${scope}`);

        await fsDataStore.writeFile(name, file, scope);
      },
    ),
    ensureBaselineSnapshot: vi.fn(
      async (name: string, scope: DataScope = "draft") => {
        order.push(`mirror:ensureBaselineSnapshot:${scope}`);

        return fsDataStore.ensureBaselineSnapshot(name, scope);
      },
    ),
    release: vi.fn(async (name: string) => {
      order.push("mirror:release");

      return fsDataStore.release(name);
    }),
  };

  return { store: { ...reads, ...writes } satisfies DataStore, reads, writes };
};

/** A mirror that fails every one of its methods, standing in for a disk that cannot be written. */
const makeFailingMirror = () => {
  const failure = new Error("the local copy could not be written");
  const mirror = {
    readFile: vi.fn(() => Promise.resolve("mirror bytes")),
    writeFile: vi.fn(() => Promise.reject(failure)),
    ensureBaselineSnapshot: vi.fn(() => Promise.reject(failure)),
    release: vi.fn(() => Promise.reject(failure)),
    listHistory: vi.fn(() => Promise.resolve([])),
    readHistory: vi.fn(() => Promise.resolve("mirror history")),
  } satisfies DataStore;

  return mirror;
};

describe("createMirroringDataStore", () => {
  describe("a draft save", () => {
    it("lands in both stores as the same JSON, primary first", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({ order });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await store.writeFile("poems", {
        name: "poems",
        timestamp: 200,
        data: "the newest save",
      });

      const primaryText = primary.objects.get("draft/poems.json");

      expect(primaryText).toBe(
        jsonText({ name: "poems", timestamp: 200, data: "the newest save" }),
      );
      expect(readLocal("draft", "poems.json")).toBe(primaryText);
      expect(order).toEqual([
        "primary:writeFile:draft",
        "mirror:writeFile:draft",
      ]);
    });

    /**
     * The assertion most likely to be written wrongly, and the reason the wrapper mirrors each mutation
     * immediately after the primary's own copy of it. A wrapper that mirrored the whole batch in a
     * different order - `writeFile` on the mirror before the mirror's `ensureBaselineSnapshot`, say -
     * would leave the mirror snapshoting the payload that replaced the old draft instead of the draft
     * that used to be there, and the version a restore screen would offer is the one nobody saved.
     *
     * So the test names the version that must exist on BOTH sides (100, holding the old payload) and
     * then reads it off disk, rather than only counting calls.
     */
    it("snapshots the pre-save draft on both stores", async () => {
      const order: string[] = [];
      const OLD = jsonText({
        name: "poems",
        timestamp: 100,
        data: "the version that was there before",
      });
      const primary = makeFakePrimary({
        order,
        seed: { "draft/poems.json": OLD },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      writeLocal(["draft", "poems.json"], OLD);

      await store.ensureBaselineSnapshot("poems");
      await store.writeFile("poems", {
        name: "poems",
        timestamp: 200,
        data: "the new save",
      });

      expect(order).toEqual([
        "primary:ensureBaselineSnapshot:draft",
        "mirror:ensureBaselineSnapshot:draft",
        "primary:writeFile:draft",
        "mirror:writeFile:draft",
      ]);

      expect(readLocal("history", "draft", "poems", "100.json")).toBe(OLD);
      expect(primary.objects.get("history/draft/poems/100.json")).toBe(OLD);

      // `writeFile` snapshots what it wrote, which is a copy of the new value, on both stores too.
      expect(readLocal("history", "draft", "poems", "200.json")).toBe(
        jsonText({ name: "poems", timestamp: 200, data: "the new save" }),
      );
      expect(readLocal("draft", "poems.json")).toBe(
        jsonText({ name: "poems", timestamp: 200, data: "the new save" }),
      );
      expect(
        (await fsDataStore.listHistory("poems")).map(
          (entry) => entry.timestamp,
        ),
      ).toEqual([200, 100]);
    });

    it("returns the primary's answer to the baseline step, whatever the mirror did", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        seed: { "draft/poems.json": jsonText({ timestamp: 100, data: "old" }) },
      });
      const mirror = makeFailingMirror();
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror,
      });

      await expect(store.ensureBaselineSnapshot("poems")).resolves.toBe(true);
      expect(mirror.ensureBaselineSnapshot).toHaveBeenCalledTimes(1);
      expect(order).toEqual(["primary:ensureBaselineSnapshot:draft"]);
    });

    it("does not reject when the mirror has nothing to snapshot, which is a key's first save", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({ order });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      // No local draft exists yet - the situation a dev prefix is in before its first save.
      await expect(store.ensureBaselineSnapshot("poems")).resolves.toBe(false);
      expect(existsLocal("draft", "poems.json")).toBe(false);
    });
  });

  describe("live-scoped writes", () => {
    it("mirrors a live write into the local live tier and its local history", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({ order });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await store.writeFile(
        "poems",
        { name: "poems", timestamp: 300, data: "published copy" },
        "live",
      );

      expect(primary.objects.get("live/poems.json")).toBe(
        jsonText({ name: "poems", timestamp: 300, data: "published copy" }),
      );
      expect(readLocal("live", "poems.json")).toBe(
        jsonText({ name: "poems", timestamp: 300, data: "published copy" }),
      );
      expect(readLocal("history", "live", "poems", "300.json")).toBe(
        jsonText({ name: "poems", timestamp: 300, data: "published copy" }),
      );
      expect(order).toEqual([
        "primary:writeFile:live",
        "mirror:writeFile:live",
      ]);
    });
  });

  describe("release", () => {
    it("leaves both stores holding the same draft, live and retired-live copy", async () => {
      const order: string[] = [];
      const DRAFT = jsonText({
        name: "poems",
        timestamp: 200,
        data: "the draft being released",
      });
      const LIVE = jsonText({
        name: "poems",
        timestamp: 150,
        data: "what visitors were reading until now",
      });
      const primary = makeFakePrimary({
        order,
        seed: { "draft/poems.json": DRAFT, "live/poems.json": LIVE },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      writeLocal(["draft", "poems.json"], DRAFT);
      writeLocal(["live", "poems.json"], LIVE);

      await expect(store.release("poems")).resolves.toBe(200);

      // The released copy, and the version the release retired, on both sides.
      expect(primary.objects.get("live/poems.json")).toBe(DRAFT);
      expect(readLocal("live", "poems.json")).toBe(DRAFT);
      expect(primary.objects.get("history/live/poems/150.json")).toBe(LIVE);
      expect(readLocal("history", "live", "poems", "150.json")).toBe(LIVE);

      // A release copies the draft onto live; it does not move or rewrite the draft itself.
      expect(primary.objects.get("draft/poems.json")).toBe(DRAFT);
      expect(readLocal("draft", "poems.json")).toBe(DRAFT);
      expect(order).toEqual(["primary:release", "mirror:release"]);
    });

    it("keeps the timestamp the primary released, when the mirror could not follow", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        seed: {
          "draft/poems.json": jsonText({ timestamp: 200, data: "draft" }),
        },
      });
      const mirror = makeFailingMirror();
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror,
      });

      await expect(store.release("poems")).resolves.toBe(200);
    });
  });

  describe("reads and queries", () => {
    it("answer from the primary even when the mirror holds different bytes", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        seed: {
          "draft/poems.json": jsonText({
            name: "poems",
            timestamp: 1,
            data: "from the primary",
          }),
          "history/draft/poems/1.json": jsonText({
            timestamp: 1,
            data: "primary version",
          }),
        },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      writeLocal(
        ["draft", "poems.json"],
        jsonText({ name: "poems", timestamp: 1, data: "a stale local copy" }),
      );
      writeLocal(
        ["history", "draft", "poems", "9999.json"],
        jsonText({ timestamp: 9999, data: "a version only the mirror has" }),
      );

      const draft = await store.readFile("poems");

      expect(JSON.parse(draft).data).toBe("from the primary");

      // The mirror holds a version the primary does not, and the wrapper must not offer it.
      await expect(store.readHistory("poems", 9999)).rejects.toThrow(
        "primary holds no object at history/draft/poems/9999.json",
      );
      expect(await store.listHistory("poems")).toEqual([
        { timestamp: 1, scope: "draft" },
      ]);

      expect(mirror.reads.readFile).not.toHaveBeenCalled();
      expect(mirror.reads.readHistory).not.toHaveBeenCalled();
      expect(mirror.reads.listHistory).not.toHaveBeenCalled();
    });

    /**
     * The failure case is where a mirror is dangerous, so it is asserted directly: a primary read that
     * cannot answer must fail rather than hand back a copy, because a caller holding a copy would go on
     * to save it over the draft it was trying to reach. These four assertions are what a "helpful"
     * read fallback would have to survive.
     */
    it("rejects a draft read the primary cannot answer, instead of serving the local copy", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        failures: { readFile: new Error("the bucket is unreachable") },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      writeLocal(
        ["draft", "poems.json"],
        jsonText({ name: "poems", timestamp: 100, data: "a stale local copy" }),
      );

      await expect(store.readFile("poems")).rejects.toThrow(
        "the bucket is unreachable",
      );
      expect(mirror.reads.readFile).not.toHaveBeenCalled();
      expect(readLocal("draft", "poems.json")).toContain("a stale local copy");
    });

    it("rejects a history read the primary cannot answer, instead of offering the mirror's version", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        failures: { readHistory: new Error("the bucket is unreachable") },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      writeLocal(
        ["history", "draft", "poems", "100.json"],
        jsonText({ timestamp: 100, data: "a version only the mirror holds" }),
      );

      await expect(store.readHistory("poems", 100)).rejects.toThrow(
        "the bucket is unreachable",
      );
      expect(mirror.reads.readHistory).not.toHaveBeenCalled();
      expect(readLocal("history", "draft", "poems", "100.json")).toContain(
        "only the mirror holds",
      );
    });

    it("rejects a history list the primary cannot answer, instead of listing the mirror's", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        failures: { listHistory: new Error("the bucket is unreachable") },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      writeLocal(
        ["history", "draft", "poems", "100.json"],
        jsonText({ timestamp: 100, data: "a version only the mirror holds" }),
      );

      await expect(store.listHistory("poems")).rejects.toThrow(
        "the bucket is unreachable",
      );
      expect(mirror.reads.listHistory).not.toHaveBeenCalled();
    });

    it("delegates a bundled read to the primary without touching the mirror", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        seed: { "bundled/layout": '{"bundled":true}\n' },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await expect(store.readFile("layout", "bundled")).resolves.toBe(
        '{"bundled":true}\n',
      );
      expect(order).toEqual(["primary:readFile:bundled"]);
      expect(mirror.reads.readFile).not.toHaveBeenCalled();
    });
  });

  describe("a mirror that cannot write", () => {
    let logSpy: Mock<(...args: unknown[]) => void>;

    beforeEach(() => {
      logSpy = vi.fn();
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        logSpy(...args);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("lets the primary's write stand and says so out loud", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({ order });
      const mirror = makeFailingMirror();
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror,
      });

      await expect(
        store.writeFile("poems", { timestamp: 200, data: "saved" }),
      ).resolves.toBeUndefined();

      expect(primary.objects.has("draft/poems.json")).toBe(true);
      expect(logSpy).toHaveBeenCalledTimes(1);

      const [message, cause] = logSpy.mock.calls[0] ?? ["", undefined];

      expect(message).toContain("poems");
      expect(message).toContain("draft");
      expect(message).toContain("writeFile");
      expect((cause as Error).message).toBe(
        "the local copy could not be written",
      );
    });

    it("logs a failed baseline mirror instead of rejecting", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({ order });
      const mirror = makeFailingMirror();
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror,
      });

      await expect(store.ensureBaselineSnapshot("poems")).resolves.toBe(false);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0]?.[0]).toContain("ensureBaselineSnapshot");
    });

    it("logs a failed release mirror instead of rejecting, and still reports the release", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        seed: { "draft/poems.json": jsonText({ timestamp: 200, data: "d" }) },
      });
      const mirror = makeFailingMirror();
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror,
      });

      await expect(store.release("poems")).resolves.toBe(200);
      expect(mirror.release).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0]?.[0]).toContain("release");
    });

    it("does not report a successful mirror as a failure", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({ order });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await store.writeFile("poems", { timestamp: 200, data: "saved" });

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("a primary that cannot write", () => {
    it("rejects the caller and never writes the mirror", async () => {
      const order: string[] = [];
      const failure = new Error("the bucket is unreachable");
      const primary = makeFakePrimary({
        order,
        failures: { writeFile: failure },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await expect(
        store.writeFile("poems", { timestamp: 200, data: "saved" }),
      ).rejects.toThrow("the bucket is unreachable");

      expect(mirror.writes.writeFile).not.toHaveBeenCalled();
      expect(existsLocal("draft", "poems.json")).toBe(false);
    });

    it("never mirrors a failed baseline snapshot", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        failures: {
          ensureBaselineSnapshot: new Error("the bucket is unreachable"),
        },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await expect(store.ensureBaselineSnapshot("poems")).rejects.toThrow(
        "the bucket is unreachable",
      );
      expect(mirror.writes.ensureBaselineSnapshot).not.toHaveBeenCalled();
    });

    it("never mirrors a failed release", async () => {
      const order: string[] = [];
      const primary = makeFakePrimary({
        order,
        failures: { release: new Error("the bucket is unreachable") },
      });
      const mirror = makeMirrorSpy(order);
      const store = createMirroringDataStore({
        primary: primary.store,
        mirror: mirror.store,
      });

      await expect(store.release("poems")).rejects.toThrow(
        "the bucket is unreachable",
      );
      expect(mirror.writes.release).not.toHaveBeenCalled();
    });
  });
});

describe("CONTENT_LOCAL_MIRROR", () => {
  it("is on unless the value is exactly false", () => {
    // Default on: the case the mirror protects against is a lost bucket, which is not a moment in
    // which anybody is configuring anything. Only an explicit false turns it off.
    expect(isLocalMirrorEnabled()).toBe(true);

    localMirrorValue = "true";
    expect(isLocalMirrorEnabled()).toBe(true);

    localMirrorValue = "TRUE";
    expect(isLocalMirrorEnabled()).toBe(true);

    localMirrorValue = "on";
    expect(isLocalMirrorEnabled()).toBe(true);

    localMirrorValue = "false";
    expect(isLocalMirrorEnabled()).toBe(false);

    localMirrorValue = "  FALSE  ";
    expect(isLocalMirrorEnabled()).toBe(false);
  });

  it("wraps the S3 store in the mirror so a save reaches both", async () => {
    liveSourceValue = "s3";
    prefixValue = "dev-data";

    const store = contentDataStore();

    await store.writeFile("poems", {
      name: "poems",
      timestamp: 400,
      data: "written in S3 mode",
    });

    expect(s3Calls).toContain("put:dev-data/draft/poems.json");
    expect(readLocal("draft", "poems.json")).toBe(
      jsonText({ name: "poems", timestamp: 400, data: "written in S3 mode" }),
    );
  });

  it("answers a read from the bucket while a stale local draft stays unread", async () => {
    liveSourceValue = "s3";
    prefixValue = "dev-data";
    s3Objects.set(
      "dev-data/draft/poems.json",
      jsonText({
        name: "poems",
        timestamp: 500,
        data: "the bucket's own draft",
      }),
    );
    writeLocal(
      ["draft", "poems.json"],
      jsonText({
        name: "poems",
        timestamp: 100,
        data: "a stale local copy from an older run",
      }),
    );

    const store = contentDataStore();

    await expect(store.readFile("poems")).resolves.toBe(
      jsonText({
        name: "poems",
        timestamp: 500,
        data: "the bucket's own draft",
      }),
    );

    // A read leaves the local copy exactly as stale as it was: it is never what an editor is shown, and
    // never what an editor's next save is built from.
    expect(readLocal("draft", "poems.json")).toBe(
      jsonText({
        name: "poems",
        timestamp: 100,
        data: "a stale local copy from an older run",
      }),
    );

    // The mirror's whole purpose is the other half: a save replaces the copy instead of reading it.
    await store.writeFile("poems", {
      name: "poems",
      timestamp: 600,
      data: "a save the bucket accepted",
    });

    expect(s3Objects.get("dev-data/draft/poems.json")).toBe(
      jsonText({
        name: "poems",
        timestamp: 600,
        data: "a save the bucket accepted",
      }),
    );
    expect(readLocal("draft", "poems.json")).toBe(
      jsonText({
        name: "poems",
        timestamp: 600,
        data: "a save the bucket accepted",
      }),
    );
  });

  it("gives a bucket-only store when CONTENT_LOCAL_MIRROR is false", async () => {
    liveSourceValue = "s3";
    prefixValue = "dev-data";
    localMirrorValue = "false";

    const store = contentDataStore();

    await store.writeFile("poems", {
      name: "poems",
      timestamp: 400,
      data: "written in S3 mode",
    });

    expect(s3Calls).toContain("put:dev-data/draft/poems.json");
    expect(existsLocal("draft", "poems.json")).toBe(false);
  });

  it("leaves the filesystem store exactly as it was, because it already writes local copies", () => {
    liveSourceValue = undefined;

    expect(contentDataStore()).toBe(fsDataStore);
  });
});

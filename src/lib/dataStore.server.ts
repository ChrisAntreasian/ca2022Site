import * as fs from "fs";
import path from "path";

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { e500 } from "#lib/error";
import { getOptionalS3Bucket, getS3Client, s3BodyToString } from "#lib/s3";

/**
 * Which copy of a content key a read or write targets.
 *
 * `"draft"` is the editor's working copy — written on every save, never served publicly by default.
 * `"live"` is what visitors see and is written only by `release`. Keeping the scope on the interface
 * rather than splitting it into two store instances means a resource module has one store and one
 * content key, and the draft/live distinction is a property of the operation, not of the wiring.
 *
 * `"bundled"` is read-only and belongs to the public read path (`#lib/content.server`): it resolves to
 * the payload the build ships rather than to anything in storage, so content pinned to the bundle —
 * `layout`, `landing` — cannot be moved by a write or broken by an outage. It is not a valid target for
 * `writeFile`, `ensureBaselineSnapshot` or `release`.
 */
export type DataScope = "draft" | "live";

/** A read scope that also admits the build-shipped copy. Storage implementations resolve it. */
export type ReadScope = DataScope | "bundled";

/**
 * Which tier a *saved version* lives in, as opposed to which tier a live file is in.
 *
 * `"legacy"` names the flat, pre-S3 history that `#lib/file` still writes on the dev-only Strapi import
 * path: `src/data/history/<name>/<timestamp>.json`, with no draft/live distinction. Most of the site's
 * genuinely edited versions are in that layout, so a history reader that ignored it would report that
 * `poems` and `web-experience` — the most-edited keys — have no history at all. S3 has no legacy tier:
 * the flat layout only ever existed on a laptop.
 */
export type SnapshotScope = DataScope | "legacy";

/**
 * One saved version, as the store lists it. `timestamp` doubles as its identity: it is the number the
 * snapshot file is named after, and what `readHistory` takes back to fetch that version.
 */
export type HistoryEntry = { timestamp: number; scope: SnapshotScope };

export type HistoryListOptions = {
  /** Which tier to look in. Defaults to `"all"`, which merges the tiers newest-first. */
  scope?: SnapshotScope | "all";
  /** How many versions to return. The store does not decide how many a screen should show. */
  limit?: number;
};

/**
 * Raised by either store when the version a caller asked for is genuinely not there.
 *
 * Each store reports a miss its own way — `ENOENT` on disk, `NoSuchKey` or a 404 on S3 — and each one
 * classifies its own shapes here so no call site has to. Without this, an editor route deciding between
 * "this version was deleted" and "the bucket refused the request" would be repeating the mistake the
 * body normalizer settled on the read side: sniffing around inside another layer's error vocabulary.
 */
export class MissingSnapshotError extends Error {
  constructor(name: string, timestamp: number, scope: SnapshotScope) {
    super(
      `No ${scope} snapshot of ${name} at version ${timestamp} is held in history.`,
    );
    this.name = "MissingSnapshotError";
  }
}

/** Whether `err` is a store saying the saved version is not there, whichever store raised it. */
export const isMissingSnapshot = (err: unknown): boolean =>
  err instanceof MissingSnapshotError;

/**
 * The storage seam for editor JSON.
 *
 * `createJsonEditorStore` talks to this interface and nothing else, so swapping the filesystem
 * behind it for S3 is a matter of building another `DataStore` — no resource module or route has
 * to know the difference. Phase 1 keeps the fs implementation here unchanged on purpose: the seam
 * is proven by behaviour being identical, not by new functionality.
 */
export interface DataStore {
  /** Raw JSON text for a content key, as written by `writeFile`. Implementations decide where it lives. */
  readFile(name: string, scope?: ReadScope): Promise<string>;
  /** Serialize and persist a versioned file value for a content key. */
  writeFile(name: string, file: unknown, scope?: DataScope): Promise<void>;
  /**
   * Copy the current version into history under its own timestamp so it can be recovered before
   * it is overwritten. Resolves to whether a snapshot was actually created.
   */
  ensureBaselineSnapshot(name: string, scope?: DataScope): Promise<boolean>;
  /**
   * Publish the draft copy of a content key by copying it onto the live copy, after snapshoting
   * whatever was previously live. Returns the timestamp the released live version carries.
   *
   * Implementations must snapshot before overwriting: a release that overwrites live first has
   * nothing left to undo.
   */
  release(name: string): Promise<number>;
  /**
   * The saved versions of a content key, newest first, capped at `limit`.
   *
   * Read-only on purpose: `writeFile` and `release` are the only writers of history, and a list that
   * could itself be written back is a list a stale screen could overwrite.
   */
  listHistory(
    name: string,
    options?: HistoryListOptions,
  ): Promise<HistoryEntry[]>;
  /**
   * Raw JSON text of one saved version. A version that is not there fails as `MissingSnapshotError`;
   * it never resolves to an empty string, because an empty read is what would let a restore overwrite
   * a real file with nothing.
   */
  readHistory(
    name: string,
    timestamp: number,
    scope?: SnapshotScope,
  ): Promise<string>;
}

const dataFilePath = (name: string, scope: DataScope) => {
  const directory = scope === "live" ? "live" : "draft";
  return `./src/data/${directory}/${name}.json`;
};
const historyDirPath = (name: string, scope: DataScope) =>
  `./src/data/history/${scope}/${name}`;
const historyFilePath = (name: string, timestamp: number, scope: DataScope) =>
  `${historyDirPath(name, scope)}/${timestamp}.json`;

/** `src/data/history/<name>/` — the flat layout `#lib/file` wrote before draft/live tiers existed. */
const legacyHistoryDirPath = (name: string) => `./src/data/history/${name}`;

const snapshotDirPath = (name: string, scope: SnapshotScope) =>
  scope === "legacy" ? legacyHistoryDirPath(name) : historyDirPath(name, scope);

const snapshotFilePath = (
  name: string,
  timestamp: number,
  scope: SnapshotScope,
) => `${snapshotDirPath(name, scope)}/${timestamp}.json`;

/** Which scope an operation targets when the caller did not say. */
const DEFAULT_SCOPE: DataScope = "draft";

/** The tiers a merged history list reads from, and the only tiers a snapshot can belong to. */
const SNAPSHOT_SCOPES: SnapshotScope[] = ["draft", "live", "legacy"];

/** How many versions a list reads when the caller did not cap it. Keeps a two-deep directory cheap. */
const DEFAULT_HISTORY_LIMIT = 100;

/**
 * A saved version is a file named after its own timestamp in milliseconds, written canonically. Any
 * other name in a history directory is not a version, so it is ignored rather than guessed at: a
 * half-written file, a stray note, or a name with padding a listing would disagree about must not
 * become a phantom version a screen offers to restore.
 */
const HISTORY_FILE_RX = /^([1-9]\d*)\.json$/;

/**
 * Whether an S3 failure means the object is not there, as opposed to the bucket being unreachable.
 * Both shapes are checked by class identity because v3 HEADs a missing key as `NotFound` while a GET
 * reports `NoSuchKey`.
 */
const isMissingKey = (err: unknown): boolean => {
  if (err instanceof NoSuchKey || err instanceof NotFound) return true;

  const code = (err as { code?: string }).code;

  return code === "NoSuchKey" || code === "NotFound";
};

/**
 * The flat pre-S3 file a page used to import directly (`./src/data/<name>.json`). A `"bundled"` read
 * resolves here rather than to a draft or live copy so that bundled content keeps pointing at the payload
 * the build actually ships, and never at an editor's working draft.
 */
const bundledFilePath = (name: string) => `./src/data/${name}.json`;

/**
 * Filesystem-backed store. This is the pre-S3 behaviour moved out of `#lib/file` — same paths, same
 * snapshot-first ordering, same silent-failure semantics for the baseline step. The serializer lives
 * here rather than in the caller so an S3 store can produce byte-identical objects without either
 * side having to know the other serializes differently.
 */
export const fsDataStore: DataStore = {
  readFile: (name, scope = DEFAULT_SCOPE) =>
    scope === "bundled"
      ? fs.promises.readFile(bundledFilePath(name), "utf8")
      : fs.promises.readFile(dataFilePath(name, scope), "utf8"),

  writeFile: async (name, file, scope = DEFAULT_SCOPE) => {
    const json = `${JSON.stringify(file, null, 2)}\n`;

    // History first, then the current file — mirrors `writeVersionedDataFile`, which wrote the
    // timestamped snapshot before overwriting the live file. Reversing the order would leave an
    // overwrite with nothing to recover from.
    await fs.promises.mkdir(historyDirPath(name, scope), { recursive: true });
    await fs.promises.writeFile(
      historyFilePath(
        name,
        (file as { timestamp?: number }).timestamp ?? Date.now(),
        scope,
      ),
      json,
    );
    await fs.promises.mkdir(path.posix.dirname(dataFilePath(name, scope)), {
      recursive: true,
    });
    await fs.promises.writeFile(dataFilePath(name, scope), json);
  },

  ensureBaselineSnapshot: async (name, scope = DEFAULT_SCOPE) => {
    try {
      const currentJson = await fs.promises.readFile(
        dataFilePath(name, scope),
        "utf8",
      );
      const currentData = JSON.parse(currentJson) as { timestamp?: unknown };

      if (typeof currentData.timestamp !== "number") {
        return false;
      }

      await fs.promises.mkdir(historyDirPath(name, scope), { recursive: true });

      try {
        await fs.promises.access(
          historyFilePath(name, currentData.timestamp, scope),
          fs.constants.F_OK,
        );
        return false;
      } catch {
        await fs.promises.writeFile(
          historyFilePath(name, currentData.timestamp, scope),
          `${currentJson.trimEnd()}\n`,
        );
        return true;
      }
    } catch {
      return false;
    }
  },

  release: async (name) => {
    const draft = await fs.promises.readFile(
      dataFilePath(name, "draft"),
      "utf8",
    );
    const draftData = JSON.parse(draft) as { timestamp?: unknown };

    if (typeof draftData.timestamp !== "number") {
      throw e500(`Cannot release ${name}: draft has no numeric timestamp.`);
    }

    // Snapshot the outgoing live version before it is replaced, so the release is undoable. When
    // nothing has ever been released there is nothing to snapshot, which is not an error.
    try {
      const liveJson = await fs.promises.readFile(
        dataFilePath(name, "live"),
        "utf8",
      );
      const liveData = JSON.parse(liveJson) as { timestamp?: unknown };

      if (typeof liveData.timestamp === "number") {
        await fs.promises.mkdir(historyDirPath(name, "live"), {
          recursive: true,
        });
        await fs.promises.writeFile(
          historyFilePath(name, liveData.timestamp, "live"),
          `${liveJson.trimEnd()}\n`,
        );
      }
    } catch {
      // No previous live copy.
    }

    await fs.promises.mkdir(path.posix.dirname(dataFilePath(name, "live")), {
      recursive: true,
    });
    await fs.promises.writeFile(
      dataFilePath(name, "live"),
      `${draft.trimEnd()}\n`,
    );

    return draftData.timestamp;
  },

  listHistory: async (name, options = {}) => {
    const scope = options.scope ?? "all";
    const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
    const tiers = scope === "all" ? SNAPSHOT_SCOPES : [scope];
    const entries: HistoryEntry[] = [];

    for (const tier of tiers) {
      let fileNames: string[];

      try {
        fileNames = await fs.promises.readdir(snapshotDirPath(name, tier));
      } catch (err) {
        const code = (err as { code?: string }).code;

        // A tier with no directory holds no versions, which is an ordinary state rather than a
        // failure: most keys have draft history and no live history at all. Anything else — a
        // permission error, a disk that is not mounted — must not read as "this key has no history",
        // because an empty list is exactly what a screen would then render as "nothing to restore".
        if (code === "ENOENT" || code === "ENOTDIR") continue;

        throw err;
      }

      for (const fileName of fileNames) {
        const match = HISTORY_FILE_RX.exec(fileName);

        if (match) {
          entries.push({ timestamp: Number(match[1]), scope: tier });
        }
      }
    }

    // Numeric, not lexical: history files are named with millisecond timestamps, and a 12-digit one
    // from 2006 sorts *after* a 13-digit one from 2026 by filename. Sorting by name would hand a
    // screen the oldest five versions of a key and call them the newest.
    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.max(limit, 0));
  },

  readHistory: async (name, timestamp, scope = DEFAULT_SCOPE) => {
    if (!Number.isInteger(timestamp) || timestamp <= 0) {
      throw e500(
        `Cannot read a ${name} version without a valid numeric timestamp.`,
      );
    }

    try {
      return await fs.promises.readFile(
        snapshotFilePath(name, timestamp, scope),
        "utf8",
      );
    } catch (err) {
      const code = (err as { code?: string }).code;

      if (code === "ENOENT" || code === "ENOTDIR") {
        throw new MissingSnapshotError(name, timestamp, scope);
      }

      throw err;
    }
  },
};

/**
 * Storage layout for an S3-backed store. Key prefixes are the draft/live/history tiers of the plan's
 * §15, and `prefix` is only the root they hang off. A per-resource prefix would fork the tier
 * structure and make a cross-key release impossible.
 */
export type S3DataStoreOptions = {
  /** Defaults to `data`, giving keys like `data/live/poems.json`. */
  prefix?: string;
  /**
   * Bundled fallback payloads used when S3 cannot serve a live read, keyed by content key. The repo
   * copies are the cold seed and the outage safety net - they are not a serving tier, and they will
   * drift stale once edits land in S3.
   */
  fallbacks?: Partial<Record<string, string>>;
};

const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Seed a store from the JSON currently bundled in `src/data`, so draft and live both exist before
 * anything is edited. Idempotent per key/scope: an existing target is left alone unless `overwrite`
 * is set, which keeps a re-run from clobbering work already done.
 */
export const seedFromBundledData = async (
  store: DataStore,
  names: string[],
  options: { overwrite?: boolean } = {},
) => {
  const results: Array<{ name: string; scope: DataScope; status: string }> = [];

  for (const name of names) {
    for (const scope of ["draft", "live"] as const) {
      const bundledPath = `./src/data/${name}.json`;

      let raw: string;
      try {
        raw = await fs.promises.readFile(bundledPath, "utf8");
      } catch {
        results.push({ name, scope, status: "no bundled file" });
        continue;
      }

      if (
        options.overwrite !== true &&
        (await store
          .readFile(name, scope)
          .then(() => true)
          .catch(() => false))
      ) {
        results.push({ name, scope, status: "already present" });
        continue;
      }

      const parsed = JSON.parse(raw) as { timestamp?: unknown };

      await store.writeFile(
        name,
        {
          name,
          timestamp:
            typeof parsed.timestamp === "number"
              ? parsed.timestamp
              : Date.now(),
          data: (parsed as { data?: unknown }).data ?? parsed,
        },
        scope,
      );

      results.push({ name, scope, status: "seeded" });
    }
  }

  return results;
};

/**
 * S3-backed store for editor JSON.
 *
 * Key layout mirrors the filesystem layout so the two stores are visually comparable during the
 * migration: `data/draft/<name>.json`, `data/live/<name>.json`, and `data/history/<scope>/<name>/<timestamp>.json`.
 *
 * Reads never silently fall through from live to draft. If a live read fails and no fallback is
 * registered, it throws - a public page must not be able to render unpublished content because the
 * bucket was briefly unreachable or a release was forgotten.
 */
export const createS3DataStore = (
  options: S3DataStoreOptions = {},
): DataStore => {
  const prefix = options.prefix ?? "data";
  const fallbacks = options.fallbacks ?? {};

  const keyFor = (name: string, scope: DataScope) =>
    `${prefix}/${scope}/${name}.json`;
  const historyKeyFor = (name: string, timestamp: number, scope: DataScope) =>
    `${prefix}/history/${scope}/${name}/${timestamp}.json`;

  const put = (key: string, body: string) => {
    const bucket = getOptionalS3Bucket();

    if (!bucket) {
      throw e500("Cannot write content data: S3 bucket is not configured.");
    }

    return getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
      }),
    );
  };

  const get = async (key: string) => {
    const bucket = getOptionalS3Bucket();

    if (!bucket) {
      throw e500("Cannot read content data: S3 bucket is not configured.");
    }

    const result = await getS3Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    // The store deliberately does not guess at body shapes, because aws-sdk hands over a different one per
    // runtime and per operation: `s3BodyToString` reads the accessors the SDK actually provides, and a body
    // it cannot turn into text fails loudly instead of yielding an empty string. That distinction matters:
    // `readFile`'s bundled fallback is gated on a *miss* (`isNotFound`), so an object that exists but reads
    // wrong must surface rather than be answered with a stale bundled payload an editor could then write
    // back over the real one.
    return s3BodyToString(result.Body);
  };

  /** True when the object does not exist. Any other failure propagates rather than reading as "missing". */
  const exists = async (key: string) => {
    const bucket = getOptionalS3Bucket();

    if (!bucket) return false;

    try {
      await getS3Client().send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return true;
    } catch (err) {
      // v2 duck-typed the failure as `err.code === "NoSuchKey"`. v3 exports the shapes as real
      // classes, and a HEAD on a missing key reports 404 rather than NoSuchKey — so both are checked
      // by identity instead of by string sniffing. Any other failure must still propagate: reading a
      // transient outage as "this object is absent" would let a release overwrite content blind.
      if (isMissingKey(err)) return false;

      throw err;
    }
  };

  /**
   * Every key under a prefix, following the listing's own pagination.
   *
   * One page is a thousand keys, and history is the part of this bucket that grows without an upper
   * bound, so a listing that ignored `IsTruncated` would eventually report a partial history as the
   * whole one — hiding the oldest versions silently rather than erroring about it.
   */
  const listKeys = async (prefix: string): Promise<string[]> => {
    const bucket = getOptionalS3Bucket();

    if (!bucket) {
      throw e500("Cannot read content history: S3 bucket is not configured.");
    }

    const keys: string[] = [];
    let continuationToken: string | undefined;

    for (;;) {
      const listed = await getS3Client().send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of listed.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }

      if (!listed.IsTruncated) return keys;

      continuationToken = listed.NextContinuationToken ?? continuationToken;

      if (!continuationToken) return keys;
    }
  };

  return {
    readFile: async (name, scope = DEFAULT_SCOPE) => {
      // A bundled read never touches the bucket. This is what makes content pinned to the bundle immune
      // to an outage and to missing configuration — a page reads the payload the build ships, full stop.
      if (scope === "bundled") {
        const bundled = fallbacks[name];

        if (bundled === undefined) {
          throw e500(
            `Cannot read ${name} as bundled data: no bundled payload is registered for it.`,
          );
        }

        return bundled;
      }

      try {
        return await get(keyFor(name, scope));
      } catch (err) {
        const fallback = fallbacks[name];

        // Only a live read may degrade to the bundled copy, and only when S3 genuinely has nothing
        // to serve. A draft read failing is a real failure: falling back would show an editor a
        // stale payload and let it be saved back over the current one.
        if (scope === "live" && fallback !== undefined) {
          console.error(
            `[dataStore] live read failed for ${name}, using bundled fallback:`,
            err,
          );

          return fallback;
        }

        throw err;
      }
    },

    writeFile: async (name, file, scope = DEFAULT_SCOPE) => {
      const json = serialize(file);
      const timestamp =
        (file as { timestamp?: number }).timestamp ?? Date.now();

      // History first, then the current key. Same ordering as the fs store, for the same reason.
      await put(historyKeyFor(name, timestamp, scope), json);
      await put(keyFor(name, scope), json);
    },

    ensureBaselineSnapshot: async (name, scope = DEFAULT_SCOPE) => {
      try {
        const currentJson = await get(keyFor(name, scope));
        const currentData = JSON.parse(currentJson) as {
          timestamp?: unknown;
        };

        if (typeof currentData.timestamp !== "number") {
          return false;
        }

        if (await exists(historyKeyFor(name, currentData.timestamp, scope))) {
          return false;
        }

        await put(
          historyKeyFor(name, currentData.timestamp, scope),
          `${currentJson.trimEnd()}\n`,
        );

        return true;
      } catch {
        // Baseline snapshots are a precaution, not a gate: the editor already writes history on
        // every save, so a failure here must not block the save itself.
        return false;
      }
    },

    release: async (name) => {
      const draftJson = await get(keyFor(name, "draft"));
      const draftData = JSON.parse(draftJson) as { timestamp?: unknown };

      if (typeof draftData.timestamp !== "number") {
        throw e500(`Cannot release ${name}: draft has no numeric timestamp.`);
      }

      // Snapshot the outgoing live version before replacing it, so the release can be undone. The
      // ordering is not interchangeable: overwriting first leaves nothing to recover from.
      try {
        const liveJson = await get(keyFor(name, "live"));
        const liveData = JSON.parse(liveJson) as { timestamp?: unknown };

        if (typeof liveData.timestamp === "number") {
          await put(
            historyKeyFor(name, liveData.timestamp, "live"),
            `${liveJson.trimEnd()}\n`,
          );
        }
      } catch {
        // No previous live version to retire.
      }

      await put(keyFor(name, "live"), `${draftJson.trimEnd()}\n`);

      return draftData.timestamp;
    },

    listHistory: async (name, options = {}) => {
      const scope = options.scope ?? "all";
      const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;

      // The flat tier never existed in the bucket. Asking for it returns an empty list rather than an
      // error, because "no versions are held in the legacy tier of S3" is the honest answer, and
      // inventing a failure there would look like an outage to a screen that only needed a list.
      if (scope === "legacy") return [];

      // A narrower prefix is cheaper, but the parsing is identical either way, so the list stays
      // honest about which tier each key belongs to instead of trusting the prefix it was handed.
      const keys = await listKeys(
        scope === "all"
          ? `${prefix}/history/`
          : `${prefix}/history/${scope}/${name}/`,
      );
      const marker = `${prefix}/history/`;
      const entries: HistoryEntry[] = [];

      for (const key of keys) {
        if (!key.startsWith(marker)) continue;

        const [tier, keyName, fileName] = key.slice(marker.length).split("/");
        const match = HISTORY_FILE_RX.exec(fileName ?? "");

        if (
          !match ||
          keyName !== name ||
          (tier !== "draft" && tier !== "live") ||
          (scope !== "all" && scope !== tier)
        ) {
          // Not a version this key owns. A tier name nothing wrote is somebody else's object, and
          // claiming it as a saved version would put it on a screen that offers to restore it.
          continue;
        }

        entries.push({ timestamp: Number(match[1]), scope: tier });
      }

      // Same reason as on disk: these are millisecond numbers, and a filename sort puts a 12-digit
      // timestamp after a 13-digit one.
      return entries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, Math.max(limit, 0));
    },

    readHistory: async (name, timestamp, scope = DEFAULT_SCOPE) => {
      if (!Number.isInteger(timestamp) || timestamp <= 0) {
        throw e500(
          `Cannot read a ${name} version without a valid numeric timestamp.`,
        );
      }

      if (scope === "legacy") {
        throw new MissingSnapshotError(name, timestamp, scope);
      }

      try {
        return await get(historyKeyFor(name, timestamp, scope));
      } catch (err) {
        if (isMissingKey(err)) {
          throw new MissingSnapshotError(name, timestamp, scope);
        }

        throw err;
      }
    },
  };
};

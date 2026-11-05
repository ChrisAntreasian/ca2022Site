import * as fs from "fs";
import path from "path";

import { e500 } from "#lib/error";
import { getOptionalS3Bucket, getS3Client } from "#lib/s3";

/**
 * Which copy of a content key a read or write targets.
 *
 * `"draft"` is the editor's working copy — written on every save, never served publicly by default.
 * `"live"` is what visitors see and is written only by `release`. Keeping the scope on the interface
 * rather than splitting it into two store instances means a resource module has one store and one
 * content key, and the draft/live distinction is a property of the operation, not of the wiring.
 */
export type DataScope = "draft" | "live";

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
  readFile(name: string, scope?: DataScope): Promise<string>;
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
}

const dataFilePath = (name: string, scope: DataScope) => {
  const directory = scope === "live" ? "live" : "draft";
  return `./src/data/${directory}/${name}.json`;
};
const historyDirPath = (name: string, scope: DataScope) =>
  `./src/data/history/${scope}/${name}`;
const historyFilePath = (name: string, timestamp: number, scope: DataScope) =>
  `${historyDirPath(name, scope)}/${timestamp}.json`;

/** Which scope an operation targets when the caller did not say. */
const DEFAULT_SCOPE: DataScope = "draft";

/**
 * Filesystem-backed store. This is the pre-S3 behaviour moved out of `#lib/file` — same paths, same
 * snapshot-first ordering, same silent-failure semantics for the baseline step. The serializer lives
 * here rather than in the caller so an S3 store can produce byte-identical objects without either
 * side having to know the other serializes differently.
 */
export const fsDataStore: DataStore = {
  readFile: (name, scope = DEFAULT_SCOPE) =>
    fs.promises.readFile(dataFilePath(name, scope), "utf8"),

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

  const bodyToString = (body: unknown) => {
    if (typeof body === "string") return body;
    if (Buffer.isBuffer(body)) return body.toString("utf8");

    // aws-sdk v2 hands back a Buffer for `Body`, but a mocked or typed client can hand back anything.
    throw e500("Unexpected S3 object body while reading content data.");
  };

  const put = (key: string, body: string) =>
    getS3Client()
      .putObject({ Bucket: getOptionalS3Bucket()!, Key: key, Body: body })
      .promise();

  const get = async (key: string) => {
    const bucket = getOptionalS3Bucket();

    if (!bucket) {
      throw e500("Cannot read content data: S3 bucket is not configured.");
    }

    const result = await getS3Client()
      .getObject({ Bucket: bucket, Key: key })
      .promise();

    return bodyToString(result.Body);
  };

  /** True when the object does not exist. Any other failure propagates rather than reading as "missing". */
  const exists = async (key: string) => {
    const bucket = getOptionalS3Bucket();

    if (!bucket) return false;

    try {
      await getS3Client().headObject({ Bucket: bucket, Key: key }).promise();
      return true;
    } catch (err) {
      const code = (err as { code?: string }).code;

      if (code === "NoSuchKey" || code === "NotFound") return false;

      throw err;
    }
  };

  return {
    readFile: async (name, scope = DEFAULT_SCOPE) => {
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
  };
};

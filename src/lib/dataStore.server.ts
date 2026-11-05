import * as fs from "fs";

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
  readFile(name: string): Promise<string>;
  /** Serialize and persist a versioned file value for a content key. */
  writeFile(name: string, file: unknown): Promise<void>;
  /**
   * Copy the current version into history under its own timestamp so it can be recovered before
   * it is overwritten. Resolves to whether a snapshot was actually created.
   */
  ensureBaselineSnapshot(name: string): Promise<boolean>;
}

const dataFilePath = (name: string) => `./src/data/${name}.json`;
const historyDirPath = (name: string) => `./src/data/history/${name}`;
const historyFilePath = (name: string, timestamp: number) =>
  `${historyDirPath(name)}/${timestamp}.json`;

/**
 * Filesystem-backed store. This is the pre-S3 behaviour moved out of `#lib/file` — same paths, same
 * snapshot-first ordering, same silent-failure semantics for the baseline step. The serializer lives
 * here rather than in the caller so an S3 store can produce byte-identical objects without either
 * side having to know the other serializes differently.
 */
export const fsDataStore: DataStore = {
  readFile: (name) => fs.promises.readFile(dataFilePath(name), "utf8"),

  writeFile: async (name, file) => {
    const json = `${JSON.stringify(file, null, 2)}\n`;

    // History first, then the current file — mirrors `writeVersionedDataFile`, which wrote the
    // timestamped snapshot before overwriting the live file. Reversing the order would leave an
    // overwrite with nothing to recover from.
    await fs.promises.mkdir(historyDirPath(name), { recursive: true });
    await fs.promises.writeFile(
      historyFilePath(
        name,
        (file as { timestamp?: number }).timestamp ?? Date.now(),
      ),
      json,
    );
    await fs.promises.writeFile(dataFilePath(name), json);
  },

  ensureBaselineSnapshot: async (name) => {
    try {
      const currentJson = await fs.promises.readFile(
        dataFilePath(name),
        "utf8",
      );
      const currentData = JSON.parse(currentJson) as { timestamp?: unknown };

      if (typeof currentData.timestamp !== "number") {
        return false;
      }

      await fs.promises.mkdir(historyDirPath(name), { recursive: true });

      try {
        await fs.promises.access(
          historyFilePath(name, currentData.timestamp),
          fs.constants.F_OK,
        );
        return false;
      } catch {
        await fs.promises.writeFile(
          historyFilePath(name, currentData.timestamp),
          `${currentJson.trimEnd()}\n`,
        );
        return true;
      }
    } catch {
      return false;
    }
  },
};

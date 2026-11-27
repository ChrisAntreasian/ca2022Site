import { Result, Schema } from "effect";

import { e500 } from "#lib/error";
import { isMissingSnapshot } from "#lib/dataStore.server";
import type {
  DataScope,
  DataStore,
  HistoryEntry,
  ReadScope,
  SnapshotScope,
} from "#lib/dataStore.server";

/**
 * How many saved versions a screen gets when it does not say how many it wants. Five is the number the
 * restore cards show; the store's own default is 100, so a seam that never asked would let a screen list a
 * key's whole history and call it a version picker.
 */
/**
 * How many versions `listHistoryVersions` offers when a screen does not ask for a number. A version picker
 * has room for a handful, and the store's own default (`100`) is a full history listing, not a preview.
 */
const DEFAULT_VERSION_PREVIEW = 5;

/**
 * The hook a resource supplies to `restoreEntry`: the merge decides what an *entry* is for this resource,
 * which id carries it, where it lands in the list and what its dates do.
 *
 * It runs after the seam has snapshotted the current draft and before it writes the new one, and it is given
 * both files: the version being restored from, and what is current now.
 */
type SnapshotMerge<FileValue, EntryId> = (input: {
  snapshotFile: FileValue;
  currentFile: FileValue;
  entryId: EntryId;
}) => FileValue;

type JsonEditorStoreOptions<
  FileValue extends { name: string; timestamp: number; data: unknown },
> = {
  store: DataStore;
  schema: Schema.Codec<FileValue, unknown>;
  contentKey: string;
  invalidDataMessage: string;
};

export const createJsonEditorStore = <
  FileValue extends { name: string; timestamp: number; data: unknown },
>({
  store,
  schema,
  contentKey,
  invalidDataMessage,
}: JsonEditorStoreOptions<FileValue>) => {
  /**
   * The scope a read or write of this resource targets. `readFile`/`writeFile` default to draft, so
   * the editor path is unchanged; `liveReadFile` and `release` are what a public page and a release
   * action call instead. A read may also target `"bundled"`, which resolves to the payload the build
   * ships — see `#lib/content.server`.
   */
  const readFile = async (scope: ReadScope = "draft"): Promise<FileValue> => {
    const source = await store.readFile(contentKey, scope);
    const parsed = JSON.parse(source) as unknown;
    const decoded = Schema.decodeUnknownResult(schema)(parsed);

    if (Result.isFailure(decoded)) {
      throw e500(invalidDataMessage);
    }

    return Result.getOrThrow(decoded);
  };

  const liveReadFile = () => readFile("live");

  const ensureBaselineSnapshot = async (
    file?: FileValue,
    scope: DataScope = "draft",
  ) => store.ensureBaselineSnapshot(file?.name ?? contentKey, scope);

  const writeFile = async (file: FileValue, scope: DataScope = "draft") => {
    await store.writeFile(file.name || contentKey, file, scope);
  };

  /** Publish this resource's draft to live. Returns the timestamp the released version carries. */
  const release = () => store.release(contentKey);

  /**
   * Snapshot the copy the store holds right now, with no file to hand it.
   *
   * `ensureBaselineSnapshot` above takes the file a route already read, which is how a save knows what it
   * is about to replace. A restore has no such file - it may be restoring into a key that has no draft at
   * all - so it asks the store directly, and the store answers `false` when there is nothing to protect.
   * That answer is the point: no snapshot of a missing draft is invented, and nothing is written.
   */
  const snapshotCurrentDraft = (scope: DataScope = "draft") =>
    store.ensureBaselineSnapshot(contentKey, scope);

  /**
   * The versions of this key a restore can be offered, newest first, each one carrying the tier it was
   * found in.
   *
   * Asking for `"all"` is what makes the legacy tier visible: `createS3DataStore` lists draft, live and the
   * legacy copies a backfill uploaded together in one history, and the scope on each entry is what a later
   * `readHistory` must be told, because its own default is `"draft"`.
   */
  const listHistoryVersions = (
    limit = DEFAULT_VERSION_PREVIEW,
  ): Promise<HistoryEntry[]> =>
    store.listHistory(contentKey, { scope: "all", limit });

  /**
   * One saved version, decoded through the same schema a current draft is read with.
   *
   * Two failures are refused the same way and neither of them is a write: a version that is genuinely not
   * there (`MissingSnapshotError`, which the seam turns into the same 500 refusal a page sees for bad
   * content) and a version whose JSON is not this resource's shape. Everything else - an unreachable
   * bucket, a disk that is not mounted - propagates as itself, because "that version is gone" is not a
   * conclusion a store outage supports.
   */
  const readSnapshot = async (
    scope: SnapshotScope,
    timestamp: number,
  ): Promise<FileValue> => {
    let raw: string;

    try {
      raw = await store.readHistory(contentKey, timestamp, scope);
    } catch (err) {
      if (isMissingSnapshot(err)) {
        throw e500(
          `Cannot restore ${contentKey}: version ${timestamp} is not held in ${scope} history.`,
        );
      }

      throw err;
    }

    // `readFile` can afford to let a body it cannot parse stay raw - it is the read a page renders from.
    // A snapshot read is the step *before a write*, so every failure of it has to refuse the write with the
    // message the resource's own readers expect.
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw e500(invalidDataMessage);
    }

    const decoded = Schema.decodeUnknownResult(schema)(parsed);

    if (Result.isFailure(decoded)) {
      throw e500(invalidDataMessage);
    }

    return Result.getOrThrow(decoded);
  };

  /**
   * Restore this resource's whole saved record as a new draft.
   *
   * Never touches live: a live snapshot may be restored *into* the draft, and a release of that draft then
   * snapshots the outgoing live copy under its own timestamp, which is the store's own undo path. The
   * ordering here is the whole feature - snapshot what is current, then replace it.
   */
  const restoreWholeRecord = async (
    scope: SnapshotScope,
    timestamp: number,
    now = new Date(),
  ): Promise<FileValue> => {
    const snapshotFile = await readSnapshot(scope, timestamp);

    await snapshotCurrentDraft();

    const restored: FileValue = {
      ...snapshotFile,
      name: contentKey,
      timestamp: now.getTime(),
    };

    await writeFile(restored, "draft");

    return restored;
  };

  /**
   * Restore one entry out of a saved version into the current draft, leaving every other entry as it is.
   *
   * The seam stays generic - it reads, snapshots and writes, and hands the decision about what an *entry*
   * means to the resource module's merge. A resource owns its entry rules (which id wins, where the entry
   * sits in its list, what its dates do) and the seam owns the ordering rule and the draft/live boundary.
   */
  const restoreEntry = async <EntryId>(
    scope: SnapshotScope,
    timestamp: number,
    entryId: EntryId,
    merge: SnapshotMerge<FileValue, EntryId>,
    now = new Date(),
  ): Promise<FileValue> => {
    // A per-entry restore needs a draft to restore *into*. If this key has no draft yet, this read fails as
    // every other editor draft read fails, and it fails before anything is written: a draft assembled from
    // one entry out of nowhere would be a whole-record replacement wearing the words "one entry".
    const currentFile = await readFile("draft");
    const snapshotFile = await readSnapshot(scope, timestamp);

    await ensureBaselineSnapshot(currentFile, "draft");

    const merged = merge({ snapshotFile, currentFile, entryId });

    const restored: FileValue = {
      ...merged,
      name: contentKey,
      timestamp: now.getTime(),
    };

    await writeFile(restored, "draft");

    return restored;
  };

  return {
    readFile,
    liveReadFile,
    ensureBaselineSnapshot,
    writeFile,
    release,
    listHistoryVersions,
    readSnapshot,
    restoreWholeRecord,
    restoreEntry,
  };
};

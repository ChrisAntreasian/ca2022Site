import {
  poemsFileC,
  removePoemEditorValue,
  restorePoemEntryFromSnapshot,
  toPoemEditorValues,
  upsertPoemEditorValue,
  type PoemEditorValue,
  type PoemsFile,
} from "./poems";
import { createJsonEditorStore } from "../../core/store.server";
import type { SnapshotScope } from "#lib/dataStore.server";
import {
  contentDataStore,
  publicReadScope,
  requireReleasable,
  type ContentKey,
} from "#lib/content.server";

const poemsContentKey = "poems" satisfies ContentKey;

/**
 * The store poems read and write through. `publicReadScope` decides the tier a visitor sees: `"draft"`
 * while live content is still on disk, `"live"` once it is released into S3 — so this module does not
 * need to know whether the migration has happened yet.
 */
const poemsStore = createJsonEditorStore<PoemsFile>({
  store: contentDataStore(),
  schema: poemsFileC,
  contentKey: poemsContentKey,
  invalidDataMessage: "Invalid poems data file.",
});

/** What an editor reads: the working draft. */
export const readPoemsFile = async (): Promise<PoemsFile> =>
  poemsStore.readFile();

/** What a public page reads: the tier `publicReadScope` selects for this key. */
export const readPublicPoemsFile = async (): Promise<PoemsFile> =>
  poemsStore.readFile(publicReadScope(poemsContentKey));

/** @deprecated Kept so existing tests and call sites read the released copy explicitly. */
export const readLivePoemsFile = async (): Promise<PoemsFile> =>
  poemsStore.liveReadFile();

/** Publish the draft. Guarded so a bundled-tier configuration cannot reach it. */
export const releasePoemsFile = async () => {
  requireReleasable(poemsContentKey);

  return poemsStore.release();
};

export const ensurePoemsBaselineSnapshot = async (file?: PoemsFile) => {
  return poemsStore.ensureBaselineSnapshot(file);
};

export const writePoemsFile = async (file: PoemsFile) => {
  await poemsStore.writeFile(file);
};

export const savePoemEditorValue = async (
  value: PoemEditorValue,
  now = new Date(),
) => {
  const current = await readPoemsFile();
  await ensurePoemsBaselineSnapshot(current);
  const updated = upsertPoemEditorValue(current, value, now);

  await writePoemsFile(updated);

  return updated;
};

export const deletePoemEditorValue = async (
  poemId: number,
  now = new Date(),
  sourceFile?: PoemsFile,
) => {
  const current = sourceFile ?? (await readPoemsFile());
  await ensurePoemsBaselineSnapshot(current);
  const updated = removePoemEditorValue(current, poemId, now);

  await writePoemsFile(updated);

  return updated;
};

/**
 * The saved versions a poems restore screen offers, newest first, each carrying the tier it was found in -
 * `draft`, `live`, or the `legacy` copies the backfill uploads. The scope travels with the entry because
 * `readHistory` defaults to `draft`, and a legacy version asked for with the default scope is a miss.
 */
export const listPoemEditorHistoryVersions = (limit?: number) =>
  poemsStore.listHistoryVersions(limit);

/**
 * One saved version's poems, in the editor's own entry shape: what a picker lists when the version it was
 * reached from is a snapshot rather than the current draft.
 */
export const readPoemEditorSnapshotEntries = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<ReadonlyArray<PoemEditorValue>> =>
  toPoemEditorValues(await poemsStore.readSnapshot(scope, timestamp));

export type RestorePoemEditorEntryParams = {
  /** The tier the version was found in, exactly as `listPoemEditorHistoryVersions` reported it. */
  scope: SnapshotScope;
  /** Which saved version to read, out of that tier. */
  timestamp: number;
  /** Which poem to put back. Every other current poem is left where it is. */
  poemId: number;
  now?: Date;
};

/**
 * Put one poem back into the current draft out of one saved version.
 *
 * A new draft, never a live release: what a restore protects is the working copy, and publishing it stays an
 * explicit release the editor has to ask for.
 */
export const restorePoemEditorEntryFromSnapshot = async ({
  scope,
  timestamp,
  poemId,
  now = new Date(),
}: RestorePoemEditorEntryParams) =>
  poemsStore.restoreEntry(
    scope,
    timestamp,
    poemId,
    ({ snapshotFile, currentFile, entryId }) =>
      restorePoemEntryFromSnapshot({
        snapshotFile,
        currentFile,
        poemId: entryId,
        now,
      }),
    now,
  );

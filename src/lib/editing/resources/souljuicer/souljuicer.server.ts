import { deleteS3File, initS3, uploadS3File } from "#lib/s3";

import {
  applySouljuicerImagePatch,
  removeSouljuicerEntry,
  restoreSouljuicerEntryFromSnapshot,
  souljuicerFileC,
  toSouljuicerEditorValue,
  upsertSouljuicerEditorValue,
  type SouljuicerEditorEntry,
  type SouljuicerEditorValue,
  type SouljuicerFile,
  type UploadedImageAsset,
} from "./souljuicer";
import {
  persistUploadedMedia,
  replaceEntryImageMedia,
} from "../../core/media.server";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  requireReleasable,
  type ContentKey,
} from "#lib/content.server";
import type { SnapshotScope } from "#lib/dataStore.server";

const souljuicerContentKey = "the-souljuicer" satisfies ContentKey;
const souljuicerUploadKeyPrefix = "the-souljuicer";
const souljuicerStore = createJsonEditorStore<SouljuicerFile>({
  store: contentDataStore(),
  schema: souljuicerFileC,
  contentKey: souljuicerContentKey,
  invalidDataMessage: "Invalid Souljuicer data file.",
});

const souljuicerS3 = initS3();

export const readSouljuicerFile = async (): Promise<SouljuicerFile> =>
  souljuicerStore.readFile();

/** What a public page reads: the tier `publicReadScope` selects for this key. */
export const readPublicSouljuicerFile = async (): Promise<SouljuicerFile> =>
  souljuicerStore.readFile(publicReadScope(souljuicerContentKey));

/** Publish the draft. Guarded so a bundled-tier configuration cannot reach it. */
export const releaseSouljuicerFile = async () => {
  requireReleasable(souljuicerContentKey);

  return souljuicerStore.release();
};

export const ensureSouljuicerBaselineSnapshot = async (file?: SouljuicerFile) =>
  souljuicerStore.ensureBaselineSnapshot(file);

export const writeSouljuicerFile = async (file: SouljuicerFile) => {
  await souljuicerStore.writeFile(file);
};

export const saveSouljuicerEditorValue = async (
  value: SouljuicerEditorValue,
  now = new Date(),
  sourceFile?: SouljuicerFile,
) => {
  const current = sourceFile ?? (await readSouljuicerFile());
  await ensureSouljuicerBaselineSnapshot(current);
  const updated = upsertSouljuicerEditorValue(current, value, now);

  await writeSouljuicerFile(updated);

  return updated;
};

export const deleteSouljuicerEntry = async (
  entryId: number,
  now = new Date(),
  sourceFile?: SouljuicerFile,
) => {
  const current = sourceFile ?? (await readSouljuicerFile());
  await ensureSouljuicerBaselineSnapshot(current);
  const updated = removeSouljuicerEntry(current, entryId, now);

  await writeSouljuicerFile(updated);

  return updated;
};

export const persistSouljuicerUpload = async (
  file: File,
  now = new Date(),
): Promise<UploadedImageAsset> => {
  return persistUploadedMedia({
    file,
    prefix: souljuicerUploadKeyPrefix,
    uploadFile: uploadS3File(souljuicerS3),
    errorMessage: "Failed to upload Souljuicer media.",
    now,
  });
};

export const replaceSouljuicerEntryImage = async (
  file: SouljuicerFile,
  entryId: number,
  image: UploadedImageAsset,
  now = new Date(),
) => {
  return replaceEntryImageMedia({
    file,
    entryId,
    image,
    getOriginalMediaUrl: (current, targetEntryId) =>
      current.data.data.find((entry) => entry.id === targetEntryId)?.attributes
        .image.data?.attributes.url,
    applyPatch: (current, targetEntryId, asset, patchNow) =>
      applySouljuicerImagePatch(current, targetEntryId, asset, patchNow),
    saveFile: writeSouljuicerFile,
    deleteFile: (key) => deleteS3File(souljuicerS3)(key),
    now,
  });
};

/**
 * The saved versions a SoulJuicer restore screen offers, newest first, each carrying the tier it was found in
 * - `draft`, `live`, or the `legacy` copies the backfill uploads. The scope travels with the entry because
 * `readHistory` defaults to `draft`, and a legacy version asked for with the default scope is a miss.
 *
 * `the-souljuicer` is the key this card's hand-off line called "the one with no bundled live copy", and that
 * is wrong on both counts. It does have one: `src/data/the-souljuicer.json`, 20 entries, and it is in
 * `S3_CONTENT_KEYS` rather than in the bundle-pinned pair. What it has no local copy of is a *draft* -
 * `src/data/draft/the-souljuicer.json` is absent here, as it is for every key - so a local restore has to be
 * run against a seeded draft, which is what `scratch/fs-rollout-clickthrough.clickthrough.ts` does rather than
 * anything this repo ships. Its own local history is one 2023-dated version, held twice over: the same
 * `1686539745964` sits flat in `src/data/history/the-souljuicer/` as a pre-S3 copy and in
 * `src/data/history/draft/the-souljuicer/` as a draft-tier copy, so a picker shows the same timestamp under
 * two tier labels, and both copies read back the same 20 pages.
 */
export const listSouljuicerEditorHistoryVersions = (limit?: number) =>
  souljuicerStore.listHistoryVersions(limit);

/**
 * One saved version's SoulJuicer entries, in the editor's own entry shape: what a picker lists when the version
 * it was reached from is a snapshot rather than the current draft.
 */
export const readSouljuicerEditorSnapshotEntries = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<ReadonlyArray<SouljuicerEditorEntry>> =>
  toSouljuicerEditorValue(await souljuicerStore.readSnapshot(scope, timestamp))
    .entries;

export type RestoreSouljuicerEditorEntryParams = {
  /** The tier the version was found in, exactly as `listSouljuicerEditorHistoryVersions` reported it. */
  scope: SnapshotScope;
  /** Which saved version to read, out of that tier. */
  timestamp: number;
  /** Which entry to put back. Every other current entry is left where it is. */
  entryId: number;
  now?: Date;
};

/**
 * Put one entry back into the current draft out of one saved version.
 *
 * A new draft, never a live release: what a restore protects is the working copy, and publishing it stays an
 * explicit release the editor has to ask for.
 */
export const restoreSouljuicerEditorEntryFromSnapshot = async ({
  scope,
  timestamp,
  entryId,
  now = new Date(),
}: RestoreSouljuicerEditorEntryParams) =>
  souljuicerStore.restoreEntry(
    scope,
    timestamp,
    entryId,
    ({ snapshotFile, currentFile, entryId: restoredEntryId }) =>
      restoreSouljuicerEntryFromSnapshot({
        snapshotFile,
        currentFile,
        entryId: restoredEntryId,
        now,
      }),
    now,
  );

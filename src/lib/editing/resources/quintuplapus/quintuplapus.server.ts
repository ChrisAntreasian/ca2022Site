import { deleteS3File, initS3, uploadS3File } from "#lib/s3";

import {
  applyQuintuplapusImagePatch,
  quintuplapusFileC,
  removeQuintuplapusEntry,
  restoreQuintuplapusEntryFromSnapshot,
  toQuintuplapusEditorValue,
  upsertQuintuplapusEditorValue,
  type QuintuplapusEditorEntry,
  type QuintuplapusEditorValue,
  type QuintuplapusFile,
  type UploadedImageAsset,
} from "./quintuplapus";
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

const quintuplapusContentKey = "the-quintuplapus" satisfies ContentKey;
const quintuplapusUploadKeyPrefix = "the-quintuplapus";
const quintuplapusStore = createJsonEditorStore<QuintuplapusFile>({
  store: contentDataStore(),
  schema: quintuplapusFileC,
  contentKey: quintuplapusContentKey,
  invalidDataMessage: "Invalid Quintuplapus data file.",
});

const quintuplapusS3 = initS3();

export const readQuintuplapusFile = async (): Promise<QuintuplapusFile> =>
  quintuplapusStore.readFile();

/** What a public page reads: the tier `publicReadScope` selects for this key. */
export const readPublicQuintuplapusFile = async (): Promise<QuintuplapusFile> =>
  quintuplapusStore.readFile(publicReadScope(quintuplapusContentKey));

/** Publish the draft. Guarded so a bundled-tier configuration cannot reach it. */
export const releaseQuintuplapusFile = async () => {
  requireReleasable(quintuplapusContentKey);

  return quintuplapusStore.release();
};

export const ensureQuintuplapusBaselineSnapshot = async (
  file?: QuintuplapusFile,
) => quintuplapusStore.ensureBaselineSnapshot(file);

export const writeQuintuplapusFile = async (file: QuintuplapusFile) => {
  await quintuplapusStore.writeFile(file);
};

export const saveQuintuplapusEditorValue = async (
  value: QuintuplapusEditorValue,
  now = new Date(),
  sourceFile?: QuintuplapusFile,
) => {
  const current = sourceFile ?? (await readQuintuplapusFile());
  await ensureQuintuplapusBaselineSnapshot(current);
  const updated = upsertQuintuplapusEditorValue(current, value, now);

  await writeQuintuplapusFile(updated);

  return updated;
};

export const deleteQuintuplapusEntry = async (
  entryId: number,
  now = new Date(),
  sourceFile?: QuintuplapusFile,
) => {
  const current = sourceFile ?? (await readQuintuplapusFile());
  await ensureQuintuplapusBaselineSnapshot(current);
  const updated = removeQuintuplapusEntry(current, entryId, now);

  await writeQuintuplapusFile(updated);

  return updated;
};

export const persistQuintuplapusUpload = async (
  file: File,
  now = new Date(),
): Promise<UploadedImageAsset> => {
  return persistUploadedMedia({
    file,
    prefix: quintuplapusUploadKeyPrefix,
    uploadFile: uploadS3File(quintuplapusS3),
    errorMessage: "Failed to upload Quintuplapus media.",
    now,
  });
};

export const replaceQuintuplapusEntryImage = async (
  file: QuintuplapusFile,
  entryId: number,
  image: UploadedImageAsset,
  now = new Date(),
) => {
  return replaceEntryImageMedia({
    file,
    entryId,
    image,
    getOriginalMediaUrl: (current, targetEntryId) => {
      const category = current.data.data[0];

      return (category.attributes.art_pieces?.data ?? []).find(
        (entry) => entry.id === targetEntryId,
      )?.attributes.image.data?.attributes.url;
    },
    applyPatch: (current, targetEntryId, asset, patchNow) =>
      applyQuintuplapusImagePatch(current, targetEntryId, asset, patchNow),
    saveFile: writeQuintuplapusFile,
    deleteFile: (key) => deleteS3File(quintuplapusS3)(key),
    now,
  });
};

/**
 * The saved versions a Quintuplapus restore screen offers, newest first, each carrying the tier it was found
 * in - `draft`, `live`, or the `legacy` copies the backfill uploads. The scope travels with the entry because
 * `readHistory` defaults to `draft`, and a legacy version asked for with the default scope is a miss.
 *
 * `the-quintuplapus` has one saved version in the local store today, in two tiers at once: the same
 * `1686541284942` sits in `src/data/history/the-quintuplapus/` as a pre-S3 copy and in
 * `src/data/history/draft/the-quintuplapus/` as a draft-tier copy, so a picker shows it twice. It is a fact
 * about this key's local history, not about this function.
 */
export const listQuintuplapusEditorHistoryVersions = (limit?: number) =>
  quintuplapusStore.listHistoryVersions(limit);

/**
 * One saved version's Quintuplapus entries, in the editor's own entry shape: what a picker lists when the
 * version it was reached from is a snapshot rather than the current draft.
 */
export const readQuintuplapusEditorSnapshotEntries = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<ReadonlyArray<QuintuplapusEditorEntry>> =>
  toQuintuplapusEditorValue(
    await quintuplapusStore.readSnapshot(scope, timestamp),
  ).entries;

export type RestoreQuintuplapusEditorEntryParams = {
  /** The tier the version was found in, exactly as `listQuintuplapusEditorHistoryVersions` reported it. */
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
export const restoreQuintuplapusEditorEntryFromSnapshot = async ({
  scope,
  timestamp,
  entryId,
  now = new Date(),
}: RestoreQuintuplapusEditorEntryParams) =>
  quintuplapusStore.restoreEntry(
    scope,
    timestamp,
    entryId,
    ({ snapshotFile, currentFile, entryId: restoredEntryId }) =>
      restoreQuintuplapusEntryFromSnapshot({
        snapshotFile,
        currentFile,
        entryId: restoredEntryId,
        now,
      }),
    now,
  );

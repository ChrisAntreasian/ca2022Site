import { deleteS3File, initS3, uploadS3File } from "#lib/s3";

import {
  removeWebExperienceEntry,
  restoreWebExperienceEntryFromSnapshot,
  toWebExperienceEditorValue,
  upsertWebExperienceEditorValue,
  webExperienceFileC,
  type UploadedImageAsset,
  type WebExperienceEditorValue,
  type WebExperienceEntry,
  type WebExperienceFile,
} from "./web-experience";
import {
  deleteMediaByUrl,
  persistUploadedMedia,
} from "../../core/media.server";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  requireReleasable,
  type ContentKey,
} from "#lib/content.server";
import type { SnapshotScope } from "#lib/dataStore.server";

const webExperienceContentKey = "web-experience" satisfies ContentKey;
const webExperienceUploadKeyPrefix = "web-experience";
const webExperienceStore = createJsonEditorStore<WebExperienceFile>({
  store: contentDataStore(),
  schema: webExperienceFileC,
  contentKey: webExperienceContentKey,
  invalidDataMessage: "Invalid web experience data file.",
});

const webExperienceS3 = initS3();

export const persistWebExperienceUpload = async (
  file: File,
  now = new Date(),
): Promise<UploadedImageAsset> => {
  return persistUploadedMedia({
    file,
    prefix: webExperienceUploadKeyPrefix,
    uploadFile: uploadS3File(webExperienceS3),
    errorMessage: "Failed to upload web experience media.",
    now,
  });
};

export const deleteWebExperienceMedia = async (url?: string | null) => {
  await deleteMediaByUrl(url, (key) => deleteS3File(webExperienceS3)(key));
};

export const readWebExperienceFile = async (): Promise<WebExperienceFile> =>
  webExperienceStore.readFile();

/** What a public page reads: the tier `publicReadScope` selects for this key. */
export const readPublicWebExperienceFile =
  async (): Promise<WebExperienceFile> =>
    webExperienceStore.readFile(publicReadScope(webExperienceContentKey));

/** Publish the draft. Guarded so a bundled-tier configuration cannot reach it. */
export const releaseWebExperienceFile = async () => {
  requireReleasable(webExperienceContentKey);

  return webExperienceStore.release();
};

export const ensureWebExperienceBaselineSnapshot = async (
  file?: WebExperienceFile,
) => {
  return webExperienceStore.ensureBaselineSnapshot(file);
};

export const writeWebExperienceFile = async (file: WebExperienceFile) => {
  await webExperienceStore.writeFile(file);
};

export const saveWebExperienceEditorValue = async (
  value: WebExperienceEditorValue,
  now = new Date(),
  sourceFile?: WebExperienceFile,
) => {
  const current = sourceFile ?? (await readWebExperienceFile());
  await ensureWebExperienceBaselineSnapshot(current);
  const updated = upsertWebExperienceEditorValue(current, value, now);

  await writeWebExperienceFile(updated);

  return updated;
};

export const deleteWebExperienceEntry = async (
  entryId: number,
  now = new Date(),
  sourceFile?: WebExperienceFile,
) => {
  const current = sourceFile ?? (await readWebExperienceFile());
  await ensureWebExperienceBaselineSnapshot(current);
  const updated = removeWebExperienceEntry(current, entryId, now);

  await writeWebExperienceFile(updated);

  return updated;
};

/**
 * The saved versions a web experience restore screen offers, newest first, each carrying the tier it was
 * found in - `draft`, `live`, or the `legacy` copies the backfill uploads. The scope travels with the entry
 * because `readHistory` defaults to `draft`, and a legacy version asked for with the default scope is a miss.
 *
 * `web-experience` is the one entry-list key whose history is listed but not restorable today. Measured on
 * this laptop's own `src/data` - `scratch/fs-rollout-clickthrough.clickthrough.ts` for what is listed, and
 * `scratch/wx-decode-probe.clickthrough.ts` for why a listed copy will not read back: the store lists 25
 * versions for the key, 24 flat `src/data/history/web-experience/<timestamp>.json` copies plus one 65-byte
 * `history/draft/web-experience/333.json` a store test left behind, and this key's own file codec refuses all
 * 25. The refusal is the codec's, not the tier's. `webExperienceFileC` decodes every `page_details` entry of
 * the page response through `#lib/typing/page`, which requires a `poems` key inside each one, and none of the
 * 24 older copies carry one: they are refused at
 * `["data"]["data"][0]["attributes"]["page_details"]["data"][0]["attributes"]["poems"]`, a key the bundled
 * `src/data/web-experience.json` does carry. The `333.json` copy is refused one level higher, at `["data"]`,
 * because its `data` is a bare `[]` rather than a page response. Both refusals reach the editor as the route's
 * "that version could not be read" note. Listing a version is not a judgement that it can be read.
 */
export const listWebExperienceEditorHistoryVersions = (limit?: number) =>
  webExperienceStore.listHistoryVersions(limit);

/**
 * One saved version's web experience entries, in the editor's own entry shape: what a picker lists when the
 * version it was reached from is a snapshot rather than the current draft.
 */
export const readWebExperienceEditorSnapshotEntries = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<ReadonlyArray<WebExperienceEntry>> =>
  toWebExperienceEditorValue(
    await webExperienceStore.readSnapshot(scope, timestamp),
  ).entries;

export type RestoreWebExperienceEditorEntryParams = {
  /** The tier the version was found in, exactly as `listWebExperienceEditorHistoryVersions` reported it. */
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
export const restoreWebExperienceEditorEntryFromSnapshot = async ({
  scope,
  timestamp,
  entryId,
  now = new Date(),
}: RestoreWebExperienceEditorEntryParams) =>
  webExperienceStore.restoreEntry(
    scope,
    timestamp,
    entryId,
    ({ snapshotFile, currentFile, entryId: restoredEntryId }) =>
      restoreWebExperienceEntryFromSnapshot({
        snapshotFile,
        currentFile,
        entryId: restoredEntryId,
        now,
      }),
    now,
  );

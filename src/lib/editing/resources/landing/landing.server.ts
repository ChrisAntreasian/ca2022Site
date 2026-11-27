import {
  landingFileC,
  upsertLandingEditorValue,
  type LandingEditorValue,
  type LandingFile,
  type LandingSection,
} from "./landing";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  type ContentKey,
} from "#lib/content.server";
import type { SnapshotScope } from "#lib/dataStore.server";

const landingContentKey = "landing" satisfies ContentKey;
const landingStore = createJsonEditorStore<LandingFile>({
  store: contentDataStore(),
  schema: landingFileC,
  contentKey: landingContentKey,
  invalidDataMessage: "Invalid landing data file.",
});

export const readLandingFile = async (): Promise<LandingFile> =>
  landingStore.readFile();

/** What the public page loader reads. Under S3 this resolves to the live version. */
export const readPublicLandingFile = async (): Promise<LandingFile> =>
  landingStore.readFile(publicReadScope(landingContentKey));

export const ensureLandingBaselineSnapshot = async (file?: LandingFile) =>
  landingStore.ensureBaselineSnapshot(file);

export const writeLandingFile = async (file: LandingFile) => {
  await landingStore.writeFile(file);
};

export const saveLandingEditorValue = async (
  value: LandingEditorValue,
  now = new Date(),
) => {
  const current = await readLandingFile();
  await ensureLandingBaselineSnapshot(current);
  const updated = upsertLandingEditorValue(current, value, now);

  await writeLandingFile(updated);

  return updated;
};

/**
 * Replace a single home-page section by id. The current draft is read first so untouched sections and
 * their images survive the edit, matching how poems edits one poem within a shared file.
 */
export const saveLandingSectionEditorValue = async (
  section: LandingSection,
  now = new Date(),
) => {
  const current = await readLandingFile();
  await ensureLandingBaselineSnapshot(current);

  if (
    !current.data.data?.[0]?.attributes.page_details?.data?.some(
      (s) => s.id === section.id,
    )
  ) {
    return current;
  }

  const editorValue: LandingEditorValue = {
    sections: [section],
  };
  const updated = upsertLandingEditorValue(current, editorValue, now);

  await writeLandingFile(updated);

  return updated;
};

/**
 * The saved versions a landing restore screen offers, newest first, each carrying the tier it was found in.
 *
 * `landing` is a whole-record key: it has no entry id to name, so every version it offers is a whole copy of
 * the home page record, and the picker has nothing to list out of one but the record itself.
 */
export const listLandingEditorHistoryVersions = (limit?: number) =>
  landingStore.listHistoryVersions(limit);

/**
 * One saved version read as a whole landing record.
 *
 * This is the seam's `readSnapshot`, which decodes the saved copy through `landingFileC` — the same projection
 * an ordinary draft read goes through. What that projection holds is what a landing restore can put back; the
 * fields a saved copy carries that the schema does not name never reach the draft.
 */
export const readLandingEditorSnapshotRecord = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<LandingFile> => landingStore.readSnapshot(scope, timestamp);

export type RestoreLandingRecordParams = {
  /** The tier the version was found in, exactly as `listLandingEditorHistoryVersions` reported it. */
  scope: SnapshotScope;
  /** Which saved version of the whole home page record to read out of that tier. */
  timestamp: number;
  now?: Date;
};

/**
 * Put one saved version of the home page record back as the current draft.
 *
 * A new draft, never a live release: `restoreWholeRecord` is the seam's whole-record path, so this resource
 * adds no merge rule of its own — there is no entry to pick a copy of, only a record to replace.
 */
export const restoreLandingRecordFromSnapshot = async ({
  scope,
  timestamp,
  now = new Date(),
}: RestoreLandingRecordParams) =>
  landingStore.restoreWholeRecord(scope, timestamp, now);

import {
  termsOfServiceFileC,
  upsertTermsOfServiceEditorValue,
  type TermsOfServiceEditorValue,
  type TermsOfServiceFile,
} from "./terms-of-service";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  type ContentKey,
} from "#lib/content.server";
import type { SnapshotScope } from "#lib/dataStore.server";

const termsOfServiceContentKey = "terms-of-service" satisfies ContentKey;
const termsOfServiceStore = createJsonEditorStore<TermsOfServiceFile>({
  store: contentDataStore(),
  schema: termsOfServiceFileC,
  contentKey: termsOfServiceContentKey,
  invalidDataMessage: "Invalid terms-of-service data file.",
});

export const readTermsOfServiceFile = async (): Promise<TermsOfServiceFile> =>
  termsOfServiceStore.readFile();

/** What the public page reads. `terms-of-service` is not an S3 key, so this stays on disk or bundle. */
export const readPublicTermsOfServiceFile =
  async (): Promise<TermsOfServiceFile> =>
    termsOfServiceStore.readFile(publicReadScope(termsOfServiceContentKey));

export const ensureTermsOfServiceBaselineSnapshot = async (
  file?: TermsOfServiceFile,
) => termsOfServiceStore.ensureBaselineSnapshot(file);

export const writeTermsOfServiceFile = async (file: TermsOfServiceFile) => {
  await termsOfServiceStore.writeFile(file);
};

export const saveTermsOfServiceEditorValue = async (
  value: TermsOfServiceEditorValue,
  now = new Date(),
) => {
  const current = await readTermsOfServiceFile();
  await ensureTermsOfServiceBaselineSnapshot(current);
  const updated = upsertTermsOfServiceEditorValue(current, value, now);

  await writeTermsOfServiceFile(updated);

  return updated;
};

/**
 * The saved versions a terms-of-service restore screen offers, newest first, each carrying the tier it was
 * found in.
 *
 * The fastest whole-record restore on the site: one record, two fields, no entry to name and no list to keep
 * straight.
 */
export const listTermsOfServiceEditorHistoryVersions = (limit?: number) =>
  termsOfServiceStore.listHistoryVersions(limit);

/**
 * One saved version read as a whole terms-of-service record.
 *
 * `termsOfServiceFileC` names every field the record has - `name`, `timestamp`, `data.title`,
 * `data.bodyMarkdown` - so this is the one whole-record key where the projection a restore writes is the
 * saved copy it came out of, field for field.
 */
export const readTermsOfServiceEditorSnapshotRecord = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<TermsOfServiceFile> =>
  termsOfServiceStore.readSnapshot(scope, timestamp);

export type RestoreTermsOfServiceRecordParams = {
  /** The tier the version was found in, exactly as `listTermsOfServiceEditorHistoryVersions` reported it. */
  scope: SnapshotScope;
  /** Which saved version of the whole terms-of-service record to read out of that tier. */
  timestamp: number;
  now?: Date;
};

/**
 * Put one saved version of the terms-of-service record back as the current draft.
 *
 * `terms-of-service` has never had a draft tier, so this is the first thing that key's history is good for:
 * an old copy of the page, read back into a draft the editor can publish later.
 */
export const restoreTermsOfServiceRecordFromSnapshot = async ({
  scope,
  timestamp,
  now = new Date(),
}: RestoreTermsOfServiceRecordParams) =>
  termsOfServiceStore.restoreWholeRecord(scope, timestamp, now);

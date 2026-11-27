import {
  layoutFileC,
  upsertLayoutEditorValue,
  type LayoutEditorValue,
  type LayoutFile,
} from "./layout";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  type ContentKey,
} from "#lib/content.server";
import type { SnapshotScope } from "#lib/dataStore.server";

const layoutContentKey = "layout" satisfies ContentKey;
const layoutStore = createJsonEditorStore<LayoutFile>({
  store: contentDataStore(),
  schema: layoutFileC,
  contentKey: layoutContentKey,
  invalidDataMessage: "Invalid layout data file.",
});

export const readLayoutFile = async (): Promise<LayoutFile> =>
  layoutStore.readFile();

/** What the public layout loader reads. Under S3 this resolves to the live version. */
export const readPublicLayoutFile = async (): Promise<LayoutFile> =>
  layoutStore.readFile(publicReadScope(layoutContentKey));

export const ensureLayoutBaselineSnapshot = async (file?: LayoutFile) =>
  layoutStore.ensureBaselineSnapshot(file);

export const writeLayoutFile = async (file: LayoutFile) => {
  await layoutStore.writeFile(file);
};

export const saveLayoutEditorValue = async (
  value: LayoutEditorValue,
  now = new Date(),
) => {
  const current = await readLayoutFile();
  await ensureLayoutBaselineSnapshot(current);
  const updated = upsertLayoutEditorValue(current, value, now);

  await writeLayoutFile(updated);

  return updated;
};

/**
 * The saved versions a layout restore screen offers, newest first, each carrying the tier it was found in.
 *
 * `layout` is a whole-record key: one record with no entries in it, so a restore of it has no entry to name
 * and no merge rule to apply - the versions it offers are whole copies of the header record.
 */
export const listLayoutEditorHistoryVersions = (limit?: number) =>
  layoutStore.listHistoryVersions(limit);

/**
 * One saved version read as a whole layout record.
 *
 * The seam decodes it through `layoutFileC`, which is the projection the layout editor works through: an
 * entry's title, link, description and logo url. A saved copy's other fields - an image record's id, the
 * media formats, the dates - are not part of that projection, and a restore cannot carry them either.
 */
export const readLayoutEditorSnapshotRecord = async (
  scope: SnapshotScope,
  timestamp: number,
): Promise<LayoutFile> => layoutStore.readSnapshot(scope, timestamp);

export type RestoreLayoutRecordParams = {
  /** The tier the version was found in, exactly as `listLayoutEditorHistoryVersions` reported it. */
  scope: SnapshotScope;
  /** Which saved version of the whole header record to read out of that tier. */
  timestamp: number;
  now?: Date;
};

/**
 * Put one saved version of the header record back as the current draft.
 *
 * `layout` adds no merge rule: `restoreWholeRecord` is the seam's whole-record path, and this resource's
 * record is exactly that - one header, replaced whole.
 */
export const restoreLayoutRecordFromSnapshot = async ({
  scope,
  timestamp,
  now = new Date(),
}: RestoreLayoutRecordParams) =>
  layoutStore.restoreWholeRecord(scope, timestamp, now);

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

import {
  poemsFileC,
  removePoemEditorValue,
  upsertPoemEditorValue,
  type PoemEditorValue,
  type PoemsFile,
} from "./poems";
import { createJsonEditorStore } from "../../core/store.server";
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

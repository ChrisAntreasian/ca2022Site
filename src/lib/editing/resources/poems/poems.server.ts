import {
  poemsFileC,
  removePoemEditorValue,
  upsertPoemEditorValue,
  type PoemEditorValue,
  type PoemsFile,
} from "./poems";
import { createJsonEditorStore } from "../../core/store.server";

const poemsFilePath = "./src/data/poems.json";
const poemsStore = createJsonEditorStore<PoemsFile>({
  filePath: poemsFilePath,
  schema: poemsFileC,
  contentKey: "poems",
  invalidDataMessage: "Invalid poems data file.",
});

export const readPoemsFile = async (): Promise<PoemsFile> => poemsStore.readFile();

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
import { deleteS3File, initS3, uploadS3File } from "$lib/s3";

import {
  applySouljuicerImagePatch,
  removeSouljuicerEntry,
  souljuicerFileC,
  upsertSouljuicerEditorValue,
  type SouljuicerEditorValue,
  type SouljuicerFile,
  type UploadedImageAsset,
} from "./souljuicer";
import {
  persistUploadedMedia,
  replaceEntryImageMedia,
} from "../../core/media.server";
import { createJsonEditorStore } from "../../core/store.server";

const souljuicerFilePath = "./src/data/the-souljuicer.json";
const souljuicerUploadKeyPrefix = "the-souljuicer";
const souljuicerStore = createJsonEditorStore<SouljuicerFile>({
  filePath: souljuicerFilePath,
  schema: souljuicerFileC,
  contentKey: "the-souljuicer",
  invalidDataMessage: "Invalid Souljuicer data file.",
});

const souljuicerS3 = initS3();

export const readSouljuicerFile = async (): Promise<SouljuicerFile> =>
  souljuicerStore.readFile();

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
      current.data.data
        .find((entry) => entry.id === targetEntryId)
        ?.attributes.image.data?.attributes.url,
    applyPatch: (current, targetEntryId, asset, patchNow) =>
      applySouljuicerImagePatch(current, targetEntryId, asset, patchNow),
    saveFile: writeSouljuicerFile,
    deleteFile: (key) => deleteS3File(souljuicerS3)(key),
    now,
  });
};
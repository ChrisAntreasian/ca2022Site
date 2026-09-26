import { randomUUID } from "crypto";
import * as path from "path";

import { e500 } from "$lib/error";
import { deleteS3File, initS3, uploadS3File } from "$lib/s3";

import {
  applyQuintuplapusImagePatch,
  quintuplapusFileC,
  removeQuintuplapusEntry,
  upsertQuintuplapusEditorValue,
  type QuintuplapusEditorValue,
  type QuintuplapusFile,
  type UploadedImageAsset,
} from "./quintuplapus";
import {
  deleteMediaByUrl,
  persistUploadedMedia,
  replaceEntryImageMedia,
} from "./media.server";
import { createJsonEditorStore } from "./store.server";

const quintuplapusFilePath = "./src/data/the-quintuplapus.json";
const quintuplapusUploadKeyPrefix = "the-quintuplapus";
const quintuplapusStore = createJsonEditorStore<QuintuplapusFile>({
  filePath: quintuplapusFilePath,
  schema: quintuplapusFileC,
  contentKey: "the-quintuplapus",
  invalidDataMessage: "Invalid Quintuplapus data file.",
});

const quintuplapusS3 = initS3();

export const readQuintuplapusFile = async (): Promise<QuintuplapusFile> =>
  quintuplapusStore.readFile();

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

      return (category.attributes.art_pieces?.data ?? [])
        .find((entry) => entry.id === targetEntryId)
        ?.attributes.image.data?.attributes.url;
    },
    applyPatch: (current, targetEntryId, asset, patchNow) =>
      applyQuintuplapusImagePatch(current, targetEntryId, asset, patchNow),
    saveFile: writeQuintuplapusFile,
    deleteFile: (key) => deleteS3File(quintuplapusS3)(key),
    now,
  });
};
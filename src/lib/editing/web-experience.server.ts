import { randomUUID } from "crypto";
import * as path from "path";

import { e500 } from "$lib/error";
import {
  deleteS3File,
  initS3,
  uploadS3File,
} from "$lib/s3";

import {
  upsertWebExperienceEditorValue,
  webExperienceFileC,
  type UploadedImageAsset,
  type WebExperienceEditorValue,
  type WebExperienceFile,
} from "./web-experience";
import { deleteMediaByUrl, persistUploadedMedia } from "./media.server";
import { createJsonEditorStore } from "./store.server";

const webExperienceFilePath = "./src/data/web-experience.json";
const webExperienceUploadKeyPrefix = "web-experience";
const webExperienceStore = createJsonEditorStore<WebExperienceFile>({
  filePath: webExperienceFilePath,
  schema: webExperienceFileC,
  contentKey: "web-experience",
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
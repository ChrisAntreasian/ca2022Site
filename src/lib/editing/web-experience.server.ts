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

const sanitizeFileStem = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";

export const persistWebExperienceUpload = async (
  file: File,
  now = new Date(),
): Promise<UploadedImageAsset> => {
  const ext = path.extname(file.name || "") || ".bin";
  const fileName = `${now.getTime()}-${randomUUID()}-${sanitizeFileStem(file.name)}${ext}`;
  const key = `${webExperienceUploadKeyPrefix}/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploaded = await uploadS3File(webExperienceS3)(key, bytes);

  if (!uploaded?.Location) {
    throw e500("Failed to upload web experience media.");
  }

  return {
    name: file.name || fileName,
    mime: file.type || "application/octet-stream",
    size: file.size,
    url: uploaded.Location,
  };
};

export const deleteWebExperienceMedia = async (url?: string | null) => {
  if (!url) {
    return;
  }

  try {
    const parsed = new URL(url);
    const key = parsed.pathname.replace(/^\/+/, "");

    if (!key) {
      return;
    }

    await deleteS3File(webExperienceS3)(key);
  } catch {
    return;
  }
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
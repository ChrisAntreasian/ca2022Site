import { randomUUID } from "crypto";
import * as path from "path";

import { e500 } from "$lib/error";
import { deleteS3File, initS3, uploadS3File } from "$lib/s3";

import {
  applySouljuicerImagePatch,
  souljuicerFileC,
  upsertSouljuicerEditorValue,
  type SouljuicerEditorValue,
  type SouljuicerFile,
  type UploadedImageAsset,
} from "./souljuicer";
import { createJsonEditorStore } from "./store.server";

const souljuicerFilePath = "./src/data/the-souljuicer.json";
const souljuicerUploadKeyPrefix = "the-souljuicer";
const souljuicerStore = createJsonEditorStore<SouljuicerFile>({
  filePath: souljuicerFilePath,
  schema: souljuicerFileC,
  contentKey: "the-souljuicer",
  invalidDataMessage: "Invalid Souljuicer data file.",
});

const souljuicerS3 = initS3();

const sanitizeFileStem = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";

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

export const persistSouljuicerUpload = async (
  file: File,
  now = new Date(),
): Promise<UploadedImageAsset> => {
  const ext = path.extname(file.name || "") || ".bin";
  const fileName = `${now.getTime()}-${randomUUID()}-${sanitizeFileStem(file.name)}${ext}`;
  const key = `${souljuicerUploadKeyPrefix}/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploaded = await uploadS3File(souljuicerS3)(key, bytes);

  if (!uploaded?.Location) {
    throw e500("Failed to upload Souljuicer media.");
  }

  return {
    name: file.name || fileName,
    mime: file.type || "application/octet-stream",
    size: file.size,
    url: uploaded.Location,
  };
};

export const replaceSouljuicerEntryImage = async (
  file: SouljuicerFile,
  entryId: number,
  image: UploadedImageAsset,
  now = new Date(),
) => {
  const originalUrl = file.data.data
    .find((entry) => entry.id === entryId)
    ?.attributes.image.data?.attributes.url;
  const updated = applySouljuicerImagePatch(file, entryId, image, now);

  await writeSouljuicerFile(updated);

  if (originalUrl) {
    try {
      const parsed = new URL(originalUrl);
      const key = parsed.pathname.replace(/^\/+/, "");

      if (key) {
        await deleteS3File(souljuicerS3)(key);
      }
    } catch {
      return updated;
    }
  }

  return updated;
};
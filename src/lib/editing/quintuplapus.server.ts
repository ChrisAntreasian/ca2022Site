import { randomUUID } from "crypto";
import * as path from "path";

import { e500 } from "$lib/error";
import { deleteS3File, initS3, uploadS3File } from "$lib/s3";

import {
  applyQuintuplapusImagePatch,
  quintuplapusFileC,
  upsertQuintuplapusEditorValue,
  type QuintuplapusEditorValue,
  type QuintuplapusFile,
  type UploadedImageAsset,
} from "./quintuplapus";
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

const sanitizeFileStem = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";

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

export const persistQuintuplapusUpload = async (
  file: File,
  now = new Date(),
): Promise<UploadedImageAsset> => {
  const ext = path.extname(file.name || "") || ".bin";
  const fileName = `${now.getTime()}-${randomUUID()}-${sanitizeFileStem(file.name)}${ext}`;
  const key = `${quintuplapusUploadKeyPrefix}/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploaded = await uploadS3File(quintuplapusS3)(key, bytes);

  if (!uploaded?.Location) {
    throw e500("Failed to upload Quintuplapus media.");
  }

  return {
    name: file.name || fileName,
    mime: file.type || "application/octet-stream",
    size: file.size,
    url: uploaded.Location,
  };
};

export const replaceQuintuplapusEntryImage = async (
  file: QuintuplapusFile,
  entryId: number,
  image: UploadedImageAsset,
  now = new Date(),
) => {
  const category = file.data.data[0];
  const originalUrl = (category.attributes.art_pieces?.data ?? [])
    .find((entry) => entry.id === entryId)
    ?.attributes.image.data?.attributes.url;
  const updated = applyQuintuplapusImagePatch(file, entryId, image, now);

  await writeQuintuplapusFile(updated);

  if (originalUrl) {
    try {
      const parsed = new URL(originalUrl);
      const key = parsed.pathname.replace(/^\/+/, "");

      if (key) {
        await deleteS3File(quintuplapusS3)(key);
      }
    } catch {
      return updated;
    }
  }

  return updated;
};
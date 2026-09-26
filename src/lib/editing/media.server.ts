import { randomUUID } from "crypto";
import * as path from "path";

import { e500 } from "$lib/error";

export type UploadedImageAsset = {
  name: string;
  mime: string;
  size: number;
  url: string;
};

type UploadFileFn = (key: string, bytes: Buffer) => Promise<{ Location?: string } | undefined>;
type DeleteFileFn = (key: string) => Promise<unknown>;

export type PersistUploadedMediaOptions = {
  file: File;
  prefix: string;
  uploadFile: UploadFileFn;
  errorMessage: string;
  now?: Date;
};

const sanitizeFileStem = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";

export const persistUploadedMedia = async ({
  file,
  prefix,
  uploadFile,
  errorMessage,
  now = new Date(),
}: PersistUploadedMediaOptions): Promise<UploadedImageAsset> => {
  const ext = path.extname(file.name || "") || ".bin";
  const fileName = `${now.getTime()}-${randomUUID()}-${sanitizeFileStem(file.name)}${ext}`;
  const key = `${prefix}/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploaded = await uploadFile(key, bytes);

  if (!uploaded?.Location) {
    throw e500(errorMessage);
  }

  return {
    name: file.name || fileName,
    mime: file.type || "application/octet-stream",
    size: file.size,
    url: uploaded.Location,
  };
};

export const deleteMediaByUrl = async (
  url?: string | null,
  deleteFile?: DeleteFileFn,
) => {
  if (!url || !deleteFile) {
    return;
  }

  try {
    const parsed = new URL(url);
    const key = parsed.pathname.replace(/^\/+/, "");

    if (key) {
      await deleteFile(key);
    }
  } catch {
    return;
  }
};

export const replaceEntryImageMedia = async <TFile>({
  file,
  entryId,
  image,
  getOriginalMediaUrl,
  applyPatch,
  saveFile,
  deleteFile,
  now = new Date(),
}: {
  file: TFile;
  entryId: number;
  image: UploadedImageAsset;
  getOriginalMediaUrl: (file: TFile, entryId: number) => string | undefined;
  applyPatch: (file: TFile, entryId: number, image: UploadedImageAsset, now: Date) => TFile;
  saveFile: (file: TFile) => Promise<unknown> | unknown;
  deleteFile?: DeleteFileFn;
  now?: Date;
}) => {
  const originalUrl = getOriginalMediaUrl(file, entryId);
  const updated = applyPatch(file, entryId, image, now);

  await saveFile(updated);
  await deleteMediaByUrl(originalUrl, deleteFile);

  return updated;
};

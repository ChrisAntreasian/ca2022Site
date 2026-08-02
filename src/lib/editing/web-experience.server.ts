import * as fs from "fs";

import { Either, Schema } from "effect";

import { e500 } from "$lib/error";
import {
  ensureDataBaselineSnapshot,
  writeVersionedDataFile,
} from "$lib/file";

import {
  upsertWebExperienceEditorValue,
  webExperienceFileC,
  type WebExperienceEditorValue,
  type WebExperienceFile,
} from "./web-experience";

const webExperienceFilePath = "./src/data/web-experience.json";

export const readWebExperienceFile = async (): Promise<WebExperienceFile> => {
  const source = await fs.promises.readFile(webExperienceFilePath, "utf8");
  const parsed = JSON.parse(source) as unknown;
  const decoded = Schema.decodeUnknownEither(webExperienceFileC)(parsed);

  if (Either.isLeft(decoded)) {
    throw e500("Invalid web experience data file.");
  }

  return decoded.right;
};

export const ensureWebExperienceBaselineSnapshot = async (
  file?: WebExperienceFile,
) => {
  if (file) {
    return ensureDataBaselineSnapshot(file.name);
  }

  return ensureDataBaselineSnapshot("web-experience");
};

export const writeWebExperienceFile = async (file: WebExperienceFile) => {
  await writeVersionedDataFile(file);
};

export const saveWebExperienceEditorValue = async (
  value: WebExperienceEditorValue,
  now = new Date(),
) => {
  const current = await readWebExperienceFile();
  await ensureWebExperienceBaselineSnapshot(current);
  const updated = upsertWebExperienceEditorValue(current, value, now);

  await writeWebExperienceFile(updated);

  return updated;
};
import * as fs from "fs";

import { Either, Schema } from "effect";

import { e500 } from "$lib/error";
import {
  ensureDataBaselineSnapshot,
  writeVersionedDataFile,
} from "$lib/file";

import {
  poemsFileC,
  upsertPoemEditorValue,
  type PoemEditorValue,
  type PoemsFile,
} from "./poems";

const poemsFilePath = "./src/data/poems.json";

export const readPoemsFile = async (): Promise<PoemsFile> => {
  const source = await fs.promises.readFile(poemsFilePath, "utf8");
  const parsed = JSON.parse(source) as unknown;
  const decoded = Schema.decodeUnknownEither(poemsFileC)(parsed);

  if (Either.isLeft(decoded)) {
    throw e500("Invalid poems data file.");
  }

  return decoded.right;
};

export const ensurePoemsBaselineSnapshot = async (file?: PoemsFile) => {
  if (file) {
    return ensureDataBaselineSnapshot(file.name);
  }

  return ensureDataBaselineSnapshot("poems");
};

export const writePoemsFile = async (file: PoemsFile) => {
  await writeVersionedDataFile(file);
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
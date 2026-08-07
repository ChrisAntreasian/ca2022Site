import * as fs from "fs";

import { Either, Schema } from "effect";

import { e500 } from "$lib/error";
import {
  ensureDataBaselineSnapshot,
  writeVersionedDataFile,
} from "$lib/file";

type JsonEditorStoreOptions<
  FileValue extends { name: string; timestamp: number; data: unknown },
> = {
  filePath: string;
  schema: Schema.Schema<FileValue, FileValue, never>;
  contentKey: string;
  invalidDataMessage: string;
};

export const createJsonEditorStore = <
  FileValue extends { name: string; timestamp: number; data: unknown },
>({
  filePath,
  schema,
  contentKey,
  invalidDataMessage,
}: JsonEditorStoreOptions<FileValue>) => {
  const readFile = async (): Promise<FileValue> => {
    const source = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(source) as unknown;
    const decoded = Schema.decodeUnknownEither(schema)(parsed);

    if (Either.isLeft(decoded)) {
      throw e500(invalidDataMessage);
    }

    return decoded.right;
  };

  const ensureBaselineSnapshot = async (file?: FileValue) =>
    ensureDataBaselineSnapshot(file?.name ?? contentKey);

  const writeFile = async (file: FileValue) => {
    await writeVersionedDataFile(file);
  };

  return {
    readFile,
    ensureBaselineSnapshot,
    writeFile,
  };
};
import * as fs from "fs";

import { Result, Schema } from "effect";

import { e500 } from "#lib/error";
import { ensureDataBaselineSnapshot, writeVersionedDataFile } from "#lib/file";

type JsonEditorStoreOptions<
  FileValue extends { name: string; timestamp: number; data: unknown },
> = {
  filePath: string;
  schema: Schema.Codec<FileValue, unknown>;
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
    const decoded = Schema.decodeUnknownResult(schema)(parsed);

    if (Result.isFailure(decoded)) {
      throw e500(invalidDataMessage);
    }

    return Result.getOrThrow(decoded);
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

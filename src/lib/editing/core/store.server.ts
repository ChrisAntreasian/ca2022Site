import { Result, Schema } from "effect";

import { e500 } from "#lib/error";
import type { DataStore } from "#lib/dataStore.server";

type JsonEditorStoreOptions<
  FileValue extends { name: string; timestamp: number; data: unknown },
> = {
  store: DataStore;
  schema: Schema.Codec<FileValue, unknown>;
  contentKey: string;
  invalidDataMessage: string;
};

export const createJsonEditorStore = <
  FileValue extends { name: string; timestamp: number; data: unknown },
>({
  store,
  schema,
  contentKey,
  invalidDataMessage,
}: JsonEditorStoreOptions<FileValue>) => {
  const readFile = async (): Promise<FileValue> => {
    const source = await store.readFile(contentKey);
    const parsed = JSON.parse(source) as unknown;
    const decoded = Schema.decodeUnknownResult(schema)(parsed);

    if (Result.isFailure(decoded)) {
      throw e500(invalidDataMessage);
    }

    return Result.getOrThrow(decoded);
  };

  const ensureBaselineSnapshot = async (file?: FileValue) =>
    store.ensureBaselineSnapshot(file?.name ?? contentKey);

  const writeFile = async (file: FileValue) => {
    await store.writeFile(file.name || contentKey, file);
  };

  return {
    readFile,
    ensureBaselineSnapshot,
    writeFile,
  };
};

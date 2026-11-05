import { Result, Schema } from "effect";

import { e500 } from "#lib/error";
import type { DataScope, DataStore, ReadScope } from "#lib/dataStore.server";

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
  /**
   * The scope a read or write of this resource targets. `readFile`/`writeFile` default to draft, so
   * the editor path is unchanged; `liveReadFile` and `release` are what a public page and a release
   * action call instead. A read may also target `"bundled"`, which resolves to the payload the build
   * ships — see `#lib/content.server`.
   */
  const readFile = async (scope: ReadScope = "draft"): Promise<FileValue> => {
    const source = await store.readFile(contentKey, scope);
    const parsed = JSON.parse(source) as unknown;
    const decoded = Schema.decodeUnknownResult(schema)(parsed);

    if (Result.isFailure(decoded)) {
      throw e500(invalidDataMessage);
    }

    return Result.getOrThrow(decoded);
  };

  const liveReadFile = () => readFile("live");

  const ensureBaselineSnapshot = async (
    file?: FileValue,
    scope: DataScope = "draft",
  ) => store.ensureBaselineSnapshot(file?.name ?? contentKey, scope);

  const writeFile = async (file: FileValue, scope: DataScope = "draft") => {
    await store.writeFile(file.name || contentKey, file, scope);
  };

  /** Publish this resource's draft to live. Returns the timestamp the released version carries. */
  const release = () => store.release(contentKey);

  return {
    readFile,
    liveReadFile,
    ensureBaselineSnapshot,
    writeFile,
    release,
  };
};

import * as fs from "fs";
import { Effect, Either, pipe, flow, Array } from "effect";
import type { HttpError } from "@sveltejs/kit";

import { e500, type HttpErrE, type HttpErrTE } from "./error";

const dataPath = "src/data";

const dataFilePath = (name: string) => `./${dataPath}/${name}.json`;
const historyDirPath = (name: string) => `./${dataPath}/history/${name}`;
const historyFilePath = (name: string, timestamp: number) =>
  `${historyDirPath(name)}/${timestamp}.json`;

type VersionedDataFile<A> = {
  name: string;
  timestamp: number;
  data: A;
};

export const ensureDataBaselineSnapshot = async (name: string) => {
  try {
    const currentJson = await fs.promises.readFile(dataFilePath(name), "utf8");
    const currentData = JSON.parse(currentJson) as Partial<VersionedDataFile<unknown>>;

    if (typeof currentData.timestamp !== "number") {
      return false;
    }

    await fs.promises.mkdir(historyDirPath(name), { recursive: true });

    try {
      await fs.promises.access(historyFilePath(name, currentData.timestamp), fs.constants.F_OK);
      return false;
    } catch {
      await fs.promises.writeFile(
        historyFilePath(name, currentData.timestamp),
        `${currentJson.trimEnd()}\n`,
      );
      return true;
    }
  } catch {
    return false;
  }
};

export const writeVersionedDataFile = async <A>(writeData: VersionedDataFile<A>) => {
  const json = `${JSON.stringify(writeData, null, 2)}\n`;

  await fs.promises.mkdir(historyDirPath(writeData.name), { recursive: true });
  await fs.promises.writeFile(historyFilePath(writeData.name, writeData.timestamp), json);
  await fs.promises.writeFile(dataFilePath(writeData.name), json);
};

export const writeFsTE = <A>(d: [A, string]): HttpErrTE<A> =>
  pipe(
    Effect.sync(() => ({
      name: d[1],
      timestamp: Date.now(),
      data: d[0],
    })),
    Effect.flatMap((writeData) =>
      Effect.tryPromise({
        try: async () => {
          await ensureDataBaselineSnapshot(writeData.name);
          await writeVersionedDataFile(writeData);
        },
        catch: () => {
          try {
            return e500("Failed to write the data.");
          } catch (error) {
            return error as HttpError;
          }
        },
      }),
    ),
    Effect.map(() => d[0]),
  );

const routeKeys = [
  "landing",
  "layout", 
  "poems",
  "the-quintuplapus",
  "the-souljuicer",
  "web-experience",
];
type RouteKeyU = (typeof routeKeys)[number];

const keyGuard = (k: string): k is RouteKeyU =>
  Array.contains(routeKeys, k);

const mkKeyE = (rid: string): HttpErrE<RouteKeyU> => {
  const segment = rid.split("/")[1];
  if (keyGuard(segment)) {
    return Either.right(segment);
  } else {
    try {
      e500(`Data key does not exist.`);
      // This should never execute since e500 throws
      return Either.left({} as HttpError);
    } catch (err) {
      return Either.left(err as HttpError);
    }
  }
};

export const mkKeyWDefault = flow(
  mkKeyE,
  Either.getOrElse(() => "resource" as const),
);

import * as fs from "fs";
import { Effect, Either, pipe, flow, Array } from "effect";
import type { HttpError } from "@sveltejs/kit";

import { e500, type HttpErrE, type HttpErrTE } from "./error";

const dataPath = "src/data";

export const writeFsTE = <A>(d: [A, string]): HttpErrTE<A> =>
  pipe(
    Effect.sync(() => ({
      name: d[1],
      timestamp: Date.now(),
      data: d[0],
    })),
    Effect.flatMap((writeData) =>
      Effect.tryPromise({
        try: () =>
          fs.promises.writeFile(
            `./${dataPath}/${writeData.name}.json`,
            JSON.stringify(writeData),
          ),
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

import { Effect, Array, pipe } from "effect";
import type { HttpError } from "@sveltejs/kit";

import { writeFsTE } from "$lib/file";
import { throwErrIO, type HttpErrTE, e403 } from "./error";

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

const buildGate = (key: string): Effect.Effect<string, HttpError> =>
  key === VITE_BUILD_KEY && VITE_ENV === "develop"
    ? Effect.succeed(key)
    : Effect.fail(e403("Permission denied.") as HttpError);

export const writeFile = <A>(buildKey: string) => (data: A): HttpErrTE<A> =>
  writeFsTE([data, buildKey]);

export const combineResp = (
  effects: HttpErrTE<ReadonlyArray<Record<string, unknown>>>,
): HttpErrTE<Record<string, unknown>> =>
  pipe(
    effects,
    Effect.map(
      Array.reduce({} as Record<string, unknown>, (acc, curr) => ({ ...acc, ...curr })),
    ),
  );

export const buildRes = <B>(
  title: string,
  bFn: (key: string) => HttpErrTE<B>,
) =>
  (key: string) =>
    pipe(
      buildGate(key),
      Effect.flatMap(bFn),
      Effect.match({
        onFailure: throwErrIO,
        onSuccess: (data) => ({ title, data }),
      }),
    );

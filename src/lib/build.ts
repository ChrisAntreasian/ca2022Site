
import * as E from "fp-ts/Either";
import * as T from "fp-ts/Task";

import * as TE from "fp-ts/TaskEither";
import * as IO from "fp-ts/IO";

import { flow } from 'fp-ts/lib/function';
import { writeFsTE, type RouteKeyU } from '$lib/file';
import { error, type HttpError } from "@sveltejs/kit";

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

const throwErrIO = IO.of((e: HttpError) => { throw e });

export const buildGate = flow(
  E.fromPredicate(
    _ => _ === VITE_BUILD_KEY && VITE_ENV === "develop", 
    () => error(403, "Permission denied.")
  )
)

export const build = <A, B>(
  buildKey: E.Either<HttpError, RouteKeyU>,
  fetchFn: TE.TaskEither<HttpError, A>, 
  mapFn: (_: A) => { title: string, data: B }
) => flow(
  TE.fromEither,
  TE.chain(() => fetchFn),
  TE.chain(writeFsTE(buildKey)),
  TE.fold(throwErrIO(), flow(mapFn, T.of)),
);
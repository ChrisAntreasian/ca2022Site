
import { E, T, TE, IO, FN, RA } from "$lib/fp-ts";

import { writeFsTE, type RouteKeyU } from '$lib/file';
import { error, type HttpError } from "@sveltejs/kit";
import type { HttpErrE, HttpErrTE } from "./error";

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

const throwErrIO = IO.of((e: HttpError) => { throw e });

export const buildGate = FN.flow(
  E.fromPredicate(
    _ => _ === VITE_BUILD_KEY && VITE_ENV === "develop", 
    () => error(403, "Permission denied.")
  )
);
type FetchKey<A> = HttpErrTE<{
  key: E.Either<HttpError, string>;
  data: A;
}>
export const fetchKey = <A>(
  buildKey: HttpErrE<RouteKeyU>,
  fetchFn: HttpErrTE<A>
): FetchKey<A> => FN.pipe(
  fetchFn, 
  TE.map(_ => ({
    key: buildKey, 
    data: _
  }))
);
  
export const build = <A, B>(
  buildKey: HttpErrE<RouteKeyU>,
  fetchFn: HttpErrTE<A>, 
  mapFn: (_: A) => { title: string, data: B }
) => FN.flow(
  TE.fromEither,
  TE.chain(() => fetchFn),
  TE.chain(writeFsTE(buildKey)),
  TE.fold(throwErrIO(), FN.flow(mapFn, T.of)),
);

export type BuildFns<A> = HttpErrTE<{ key: E.Either<HttpError, string>, data: A }[]>;
export type KeyData = HttpErrTE<{
  key: HttpErrE<string>;
  data: Record<string, any>
}[]>

export const writeFile: (d: KeyData) => HttpErrTE<Record<string, any>> = FN.flow(
  TE.map(
    RA.reduce({}, (acc, curr) => FN.pipe(
      curr.data,
      TE.chain(_ => writeFsTE(curr.key)(_)),
      TE.chainW(_ => TE.of({acc, ...curr.data})),
    ))
  )
);

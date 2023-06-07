
import { E, T, TE, IO, FN, RA } from "$lib/fp-ts";

import { writeFsTE, type RouteKeyU } from '$lib/file';
import { error, type HttpError } from "@sveltejs/kit";
import type { HttpErrE, HttpErrTE } from "./error";

type FetchKey<A> = HttpErrTE<{
  key: E.Either<HttpError, string>;
  data: A;
}>

export type BuildFns<A> = HttpErrTE<{ key: E.Either<HttpError, string>, data: A }[]>;

export type KeyData = HttpErrTE<{
  key: HttpErrE<string>;
  data: Record<string, any>
}[]>

type WriteTE = HttpErrTE<Record<string, any>>;

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

const throwErrIO = IO.of((e: HttpError) => { throw e });

export const buildGate = FN.flow(
  E.fromPredicate(
    _ => _ === VITE_BUILD_KEY && VITE_ENV === "develop", 
    () => error(403, "Permission denied.")
  )
);

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

export const w1 = <A>(
  buildKey: HttpErrE<RouteKeyU>,
  fetchFn: HttpErrTE<A>
) => FN.flow(
  TE.chain(() => fetchFn),
  TE.chain(writeFsTE(buildKey)),
);
export const w2 = (d: KeyData) => TE.map(
  FN.pipe(
    d,
    TE.map(
      RA.reduce({}, (acc, {data, key}) => FN.pipe(
        data,
        TE.chain(writeFsTE(key)),
        TE.map(() => ({acc, ...data})),
      ))
    )
  )
);

export const build2 = <A, B>(
  fetchFns: KeyData, 
  mapFn: (_: A) => { title: string, data: B },
  writeTask: WriteTE
) => FN.flow(
  TE.fromEither,
  // writeFile(fetchFns),
  TE.fold(throwErrIO(), FN.flow(mapFn, T.of)),
);
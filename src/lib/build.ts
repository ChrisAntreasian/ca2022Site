
import { E, T, TE, FN, RA, RR } from "$lib/fp-ts";

import { writeFsTE, type RouteKeyU, writeFsTE2 } from '$lib/file';
import type { HttpError } from "@sveltejs/kit";
import { throwErrIO, type HttpErrE, type HttpErrTE, e403 } from "./error";

type FetchKey<A> = HttpErrTE<{
  key: HttpErrE<string>;
  data: A;
}>



type DataAndKey<A extends RR.ReadonlyRecord<string, any>> = ReadonlyArray<[A, string]>
const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const buildGate = FN.flow(
  E.fromPredicate(
    _ => _ === VITE_BUILD_KEY && VITE_ENV === "develop", 
    () => e403("Permission denied.")
  ),
  TE.fromEither,
);

export const fetchKey = <A>(
  buildKey: HttpErrE<RouteKeyU>,
  fetchFn: HttpErrTE<A>
): FetchKey<A> => FN.pipe(
  fetchFn, 
  TE.map(_ => ({
    key: buildKey, 
    data: _
  })),
);
  
export const build = <A, B>(
  buildKey: HttpErrE<RouteKeyU>,
  fetchFn: HttpErrTE<A>, 
  mapFn: (_: A) => { title: string, data: B }
) => FN.flow(
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

export const w2d = <A extends RR.ReadonlyRecord<string, any>>(kd: HttpErrTE<DataAndKey<A>>) => TE.chain(RA.reduce(
  TE.of({} as A), (acc: HttpErrTE<A>, curr) => FN.pipe(
    curr,
    writeFsTE2,
    TE.map((_: HttpErrTE<A>) => ({...acc, ..._}))
  )
))(kd);

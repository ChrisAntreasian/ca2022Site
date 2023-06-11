
import { E, T, TE, FN, RA, RR } from "$lib/fp-ts";

import { writeFsTE, type RouteKeyU } from '$lib/file';
import { throwErrIO, type HttpErrE, type HttpErrTE, e403 } from "./error";

type FetchKey<A> = HttpErrTE<{
  key: HttpErrE<string>;
  data: A;
}>

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
  
export const writeFile = <A>(buildKey: string) => TE.chain((_: A) => writeFsTE<A>([_, buildKey]));
  
export const combineResp: (kd: HttpErrTE<ReadonlyArray<RR.ReadonlyRecord<string, any>>>) => HttpErrTE<RR.ReadonlyRecord<string, any>> = TE.map(RA.reduce({}, (acc, curr) => ({...acc, ...curr})));

type BuildFn<A, B> = (ma: HttpErrTE<A>) => HttpErrTE<B>
export const buildRes = <A, B>(title: string, bFn: BuildFn<A, B>) => FN.flow(
  buildGate,
  bFn,
  TE.fold(throwErrIO(), FN.flow(_ => ({ title: title, data: _}), T.of))
);

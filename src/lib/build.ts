
import { E, T, TE, FN, RA, RR } from "$lib/fp-ts";

import { writeFsTE } from '$lib/file';
import { throwErrIO, type HttpErrTE, e403 } from "./error";

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const buildGate = FN.flow(
  E.fromPredicate(
    _ => _ === VITE_BUILD_KEY && VITE_ENV === "develop", 
    () => e403("Permission denied.")
  ),
  TE.fromEither,
);
  
export const writeFile = <A>(buildKey: string) => TE.chain((_: A) => writeFsTE<A>([_, buildKey]));
  
export const combineResp: (kd: HttpErrTE<ReadonlyArray<RR.ReadonlyRecord<string, any>>>) => HttpErrTE<RR.ReadonlyRecord<string, any>> = TE.map(RA.reduce({}, (acc, curr) => ({...acc, ...curr})));

export const buildRes = <A, B>(title: string, bFn:  (ma: HttpErrTE<A>) => HttpErrTE<B>) => FN.flow(
  buildGate,
  bFn,
  TE.fold(throwErrIO(), FN.flow(_ => ({ title: title, data: _}), T.of))
);

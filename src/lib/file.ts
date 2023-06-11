import * as fs from "fs";
import { s, RA, E, TE, FN } from "$lib/fp-ts";
import { e500, type HttpErrE, type HttpErrTE } from "./error";
import { cLog } from "./console";

const dataPath = 'src/data';

type DataFile<A> = {
  name: string,
  timestamp: EpochTimeStamp,
  data: A
}


export const writeFsTE2 = <A>(d: [A, string]): HttpErrTE<A> => FN.pipe(
  
  ({
    name: d[1],
    timestamp: Date.now(),
    data: d[0],
  }),
  _ =>  cLog("before")(_),
  _ => TE.tryCatch(
    () => fs.promises.writeFile(`./${dataPath}/${d[1]}.json`, JSON.stringify(_)),
    () => e500("Failed to write the data.")
  ),
  TE.bimap(
    _ => cLog("after nope")(_),
    _ =>  cLog("after yup")(_)),
  TE.map(() => d[0])
);

export const writeFsTE = <A>(k: HttpErrE<RouteKeyU>) => FN.flow(
  (d: A) => E.map(_=> ({
    name: _,
    timestamp: Date.now(),
    data: d,
  }))(k),
  TE.fromEither,
  TE.chain((_: DataFile<A>) => FN.pipe(
    TE.tryCatch(
      () => fs.promises.writeFile(`./${dataPath}/${_.name}.json`, JSON.stringify(_)),
      () => e500("Failed to write the data.")
    ),
    TE.map(() => _.data)
  ))
);

export const writeFs = async<A>(fn: string, d: A) => {
  try {
    const out: DataFile<A> = {
      name: fn,
      timestamp: Date.now(),
      data: d,
    }
    
    await fs.promises.writeFile(`./${dataPath}/${fn}.json`, JSON.stringify(out));
    return out.data;

  } catch (e) {
    throw e500("Failed to write the data.");
  }
}

const routeKeys = ["landing", "layout", "poems", "the-quintuplapus", "the-souljuicer", "web-experience"];
export type RouteKeyU = typeof routeKeys[number];

const keyGuard = (_: string): _ is RouteKeyU => FN.pipe(routeKeys, RA.elem(s.Eq)(_));

export const mkKeyE = (rid: string): HttpErrE<RouteKeyU> =>
  FN.pipe(rid.split("/")[1], E.fromPredicate(keyGuard, () => e500(`Data key does not exist.`)));

export const mkKey = (rid: string): RouteKeyU => {
  const k = rid.split("/")[1];
  if (keyGuard(k)) {
    return k;
  }
  
  throw e500(`Data key does not exist.`);
};
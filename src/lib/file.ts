import { error, type HttpError } from "@sveltejs/kit";
import * as fs from "fs";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as s from "fp-ts/string";

import { flow, pipe } from "fp-ts/lib/function";

const dataPath = 'src/data';

type DataFile<A> = {
  name: string,
  timestamp: EpochTimeStamp,
  data: A
}

export const writeFsTE = <A>(k: E.Either<HttpError, RouteKeyU>) => flow(
  (d: A) => E.map(_=> ({
    name: _,
    timestamp: Date.now(),
    data: d,
  }))(k),
  TE.fromEither,
  TE.chain((_: DataFile<A>) => pipe(
    TE.tryCatch(
      () => fs.promises.writeFile(`./${dataPath}/${k}.json`, JSON.stringify(_)),
      () => error(500, "Failed to write the data.")
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
    throw error(500, "Failed to write the data.");
  }
}

const routeKeys = ["landing", "layout", "poems", "the-quintuplapus", "the-souljuicer", "web-experience"];
export type RouteKeyU = typeof routeKeys[number];

const keyGuard = (_: string): _ is RouteKeyU => pipe(routeKeys, RA.elem(s.Eq)(_));

export const mkKeyB = (rid: string): E.Either<HttpError, RouteKeyU> =>
  pipe(rid.split("/")[1], E.fromPredicate(keyGuard, () => error(500, `Data key does not exist.`)));

export const mkKey = (rid: string): RouteKeyU => {
  const k = rid.split("/")[1];
  if (keyGuard(k)) {
    return k;
  }
  
  throw error(500, `Data key does not exist.`);
};
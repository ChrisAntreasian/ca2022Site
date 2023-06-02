import { error, type HttpError } from "@sveltejs/kit";
import * as fs from "fs";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";

import { flow, pipe } from "fp-ts/lib/function";
const dataPath = 'src/data';

type DataFile<A> = {
  name: string,
  timestamp: EpochTimeStamp,
  data: A
}

export const writeFsTE = <A>(k: E.Either<HttpError, RouteKeyU>) => (d: A) => pipe(
  k,
  E.map(_=> ({
    name: _,
    timestamp: Date.now(),
    data: d,
  })),
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
type RouteKeyU = typeof routeKeys[number];

const dataRoutes: Record<RouteKeyU, Promise<DataFile<any>>> = {
  "landing": import("../../src/data/landing.json"),
  "layout": import("../../src/data/layout.json"),
  "poems": import("../../src/data/poems.json"),
  "the-quintuplapus": import("../../src/data/the-quintuplapus.json"),
  "the-souljuicer": import("../../src/data/the-souljuicer.json"),
  "web-experience": import("../../src/data/web-experience.json")
};

const keyGuard = (s: string): s is RouteKeyU => routeKeys.includes(s);

export const mkKeyB = (rid: string): E.Either<HttpError, RouteKeyU> =>
  pipe(rid.split("/")[1], E.fromPredicate(keyGuard, () => error(500, `Data key does not exist.`)));

export const mkKey = (rid: string): RouteKeyU => {
  const k = rid.split("/")[1];
  if (keyGuard(k)) {
    return k;
  }
  
  throw error(500, `Data key does not exist.`);
};
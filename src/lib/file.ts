import * as fs from "fs";
import { s, RA, E, TE, FN } from "$lib/fp-ts";
import { e500, type HttpErrE, type HttpErrTE } from "./error";

const dataPath = 'src/data';

export const writeFsTE = <A>(d: [A, string]): HttpErrTE<A> => FN.pipe(  
  ({
    name: d[1],
    timestamp: Date.now(),
    data: d[0],
  }),
  _ => TE.tryCatch(
    () => fs.promises.writeFile(`./${dataPath}/${d[1]}.json`, JSON.stringify(_)),
    () => e500("Failed to write the data.")
  ),
  TE.map(() => d[0])
);

const routeKeys = ["landing", "layout", "poems", "the-quintuplapus", "the-souljuicer", "web-experience"];
type RouteKeyU = typeof routeKeys[number];

const keyGuard = (_: string): _ is RouteKeyU => FN.pipe(routeKeys, RA.elem(s.Eq)(_));

const mkKeyE = (rid: string): HttpErrE<RouteKeyU> => FN.pipe(
  rid.split("/")[1], 
  E.fromPredicate(keyGuard, () => e500(`Data key does not exist.`))
);

export const mkKeyWDefault = FN.flow(mkKeyE, E.getOrElse(() => "resource"));

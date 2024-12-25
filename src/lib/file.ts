import * as fs from "fs";
import {
  string as s,
  readonlyArray as RA,
  either as E,
  taskEither as TE,
  function as FN,
} from "fp-ts";

import { e500, type HttpErrE, type HttpErrTE } from "./error";

const dataPath = "src/data";

export const writeFsTE = <A>(d: [A, string]): HttpErrTE<A> =>
  FN.pipe(
    {
      name: d[1],
      timestamp: Date.now(),
      data: d[0],
    },
    (d) =>
      TE.tryCatch(
        () =>
          fs.promises.writeFile(
            `./${dataPath}/${d[1]}.json`,
            JSON.stringify(d),
          ),
        () => e500("Failed to write the data."),
      ),
    TE.map(() => d[0]),
  );

const routeKeys = [
  "landing",
  "layout",
  "poems",
  "the-quintuplapus",
  "the-souljuicer",
  "web-experience",
];
type RouteKeyU = (typeof routeKeys)[number];

const keyGuard = (k: string): k is RouteKeyU =>
  FN.pipe(routeKeys, RA.elem(s.Eq)(k));

const mkKeyE = (rid: string): HttpErrE<RouteKeyU> =>
  FN.pipe(
    rid.split("/")[1],
    E.fromPredicate(keyGuard, () => e500(`Data key does not exist.`)),
  );

export const mkKeyWDefault = FN.flow(
  mkKeyE,
  E.getOrElse(() => "resource"),
);

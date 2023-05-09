import { error } from "@sveltejs/kit";
import * as fs from "fs";

const dataPath = 'src/data';

type DataFile<A> = {
  name: string,
  timestamp: EpochTimeStamp,
  data: A
}


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

const routeKeys = ["landing", "layout", "poems", "the-quintuplapus", "the-souljuicer", "web-exp"];
type RouteKeyU = typeof routeKeys[number];

const dataRoutes: Record<RouteKeyU, Promise<DataFile<any>>> = {
  "landing": import("../../src/data/landing.json"),
  "layout": import("../../src/data/layout.json"),
  "poems": import("../../src/data/poems.json"),
  "the-quintuplapus": import("../../src/data/the-quintuplapus.json"),
  "the-souljuicer": import("../../src/data/the-souljuicer.json"),
  "web-exp": import("../../src/data/web-exp.json")
};

const keyGuard = (s: string): s is RouteKeyU => routeKeys.includes(s);

export const mkKey = (rid: string): RouteKeyU => {
  const k = rid.split("/")[1];
  if (keyGuard(k)) {
    return k;
  }
  
  throw error(500, `Data key does not exist.`);
};

export const readData = async <A>(n: RouteKeyU): Promise<DataFile<A>> => await dataRoutes[n];
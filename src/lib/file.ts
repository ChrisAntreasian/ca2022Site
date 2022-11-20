import { error } from "@sveltejs/kit";
import * as fs from "fs";

const dataPath = 'src/data';

type DataFile<A> = {
  name: string,
  timestamp: EpochTimeStamp,
  data: A
}

export const dataKey = (rid: string) => rid.split("/")[0];

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

export const readData = async <A>(n: string) => {
  try {
    const f = await fs.promises.readFile(`./${dataPath}/${n}.json`, "utf-8");
    const d: A = JSON.parse(f).data;
    return d;

  } catch (e) {
    throw error(500, "Failed to read the data.");
  }
}
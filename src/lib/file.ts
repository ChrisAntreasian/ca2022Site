import { error } from "@sveltejs/kit";
import * as fs from "fs";

const dataPath = './src/data';

export const writeFs = async<A>(fn: string, d: A) => {
  try {
    const out = {
      name: fn,
      timestamp: Date.now(),
      data: d,
    }
    
    await fs.promises.writeFile(`${dataPath}/${fn}.json`, JSON.stringify(out));
    return out.data;

  } catch (err) {
    throw error(500, "Failed to write the data.");

  }
}
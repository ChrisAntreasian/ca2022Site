import * as fs from "fs";

const dataPath = './src/data';

export const writeFs = async (fn: string, d: Record<string, any>) => {
  try {
    const out = {
      name: fn,
      timestamp: Date.now(),
      data: d,
    }
    
    await fs.promises.writeFile(`${dataPath}/${fn}.json`, JSON.stringify(out));
    return out.data;

  } catch (err) {
    console.log(err);
  }
}

export const readFs = async (fn: string) => {
  // TODO
}
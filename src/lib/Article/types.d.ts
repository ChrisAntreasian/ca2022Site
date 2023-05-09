import type { StrapiImageData } from "$lib/types";

export type Item = {
  id: number,
  title: string,
  body: string,
  logo?: string,
  screenShots?: ReadonlyArray<string>,
  omitFromNav?: boolean 
}
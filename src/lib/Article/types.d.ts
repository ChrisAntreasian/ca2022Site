import type { StrapiImageData } from "$lib/types";

export type Item = {
  id: number,
  title: string,
  body: string,
  logo?: StrapiImageData,
  screenShots?: StrapiImageData
}
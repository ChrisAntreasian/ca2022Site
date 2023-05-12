import type { StrapiImageData } from "$lib/types";

export type Item = {
  id: number,
  title: string,
  body: string,
  logo?: string,
  link?: string,
  secondLink?: string,
  images?: ReadonlyArray<{
    small: string,
    large: string
  }>,
  omitFromNav?: boolean,
  
}
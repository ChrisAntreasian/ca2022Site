import * as t from "io-ts";
import { strapiBaseC, strapiDataArrC, strapiMetaDataC } from "./strapi";

export const poemC = t.intersection([
  strapiBaseC,
  t.type({
    title: t.string,
    body: t.string,
    featured: t.boolean,
    position: t.number,
  }),
]);

export const strapiPoemC = t.intersection([
  strapiDataArrC(poemC),
  strapiMetaDataC,
]);

export type StrapiPoem = t.TypeOf<typeof strapiPoemC>;

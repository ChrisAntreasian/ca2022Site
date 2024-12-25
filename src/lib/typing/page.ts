import * as t from "io-ts";

import {
  strapiBaseC,
  strapiDataArrC,
  strapiDataC,
  strapiMetaDataC,
} from "./strapi";
import { artC, artCategoryC, imageC, strapiImageDataC } from "./art";
import { poemC } from "./poem";

const pageDetailsC = t.intersection([
  strapiBaseC,
  t.type({
    title: t.string,
    description: t.string,
    art_categories: t.union([strapiDataArrC(artCategoryC), t.undefined]),
    poems: t.union([strapiDataArrC(poemC), t.undefined, t.type({})]),
    link: t.union([t.string, t.null]),
    art_piece: t.union([strapiDataC(artC), t.undefined]),
    image: t.union([strapiImageDataC, t.undefined]),
  }),
]);

const strapiPageDetailsC = strapiDataArrC(
  t.intersection([pageDetailsC, t.type({ poems: strapiDataArrC(poemC) })]),
);
export type StrapiPageDetails = t.TypeOf<typeof strapiPageDetailsC>["data"];

const richLinkC = t.intersection([
  strapiBaseC,
  t.type({
    title: t.string,
    body: t.string,
    image: strapiDataArrC(imageC),
    logo: strapiDataC(imageC),
    link: t.string,
    secondLink: t.union([t.string, t.null]),
    position: t.number,
  }),
]);

const strapiPageC = t.intersection([
  strapiBaseC,
  t.type({
    title: t.string,
    page_details: strapiDataArrC(pageDetailsC),
    rich_links: t.union([strapiDataArrC(richLinkC), t.undefined]),
  }),
]);

export const pageResC = t.intersection([
  strapiMetaDataC,
  strapiDataArrC(strapiPageC),
]);
export type PageRes = t.TypeOf<typeof pageResC>;

export const detailsResC = t.intersection([
  strapiMetaDataC,
  strapiPageDetailsC,
]);
export type DetailsRes = t.TypeOf<typeof detailsResC>;

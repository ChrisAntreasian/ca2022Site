import { Schema } from "effect";

import {
  strapiBaseC,
  strapiDataArrC,
  strapiDataC,
  strapiMetaDataC,
} from "./strapi";
import { artC, artCategoryC, imageC, strapiImageDataC } from "./art";
import { poemC } from "./poem";

const pageDetailsC = Schema.Struct({
  ...strapiBaseC.fields,
  title: Schema.String,
  description: Schema.String,
  art_categories: Schema.optional(strapiDataArrC(artCategoryC)),
  poems: Schema.Union([
    strapiDataArrC(poemC),
    Schema.UndefinedOr(Schema.Struct({})),
  ]),
  link: Schema.NullOr(Schema.String),
  art_piece: Schema.optional(strapiDataC(artC)),
  image: Schema.optional(strapiImageDataC),
});

const strapiPageDetailsC = strapiDataArrC(pageDetailsC);
export type StrapiPageDetails = Schema.Schema.Type<
  typeof strapiPageDetailsC
>["data"];

const richLinkC = Schema.Struct({
  ...strapiBaseC.fields,
  title: Schema.String,
  body: Schema.String,
  image: strapiDataArrC(imageC),
  logo: strapiDataC(imageC),
  link: Schema.String,
  secondLink: Schema.NullOr(Schema.String),
  position: Schema.Number,
});

const strapiPageC = Schema.Struct({
  ...strapiBaseC.fields,
  title: Schema.String,
  page_details: strapiDataArrC(pageDetailsC),
  rich_links: Schema.optional(strapiDataArrC(richLinkC)),
});

export const pageResC = Schema.Struct({
  ...strapiMetaDataC.fields,
  ...strapiDataArrC(strapiPageC).fields,
});
export type PageRes = Schema.Schema.Type<typeof pageResC>;

export const detailsResC = Schema.Struct({
  ...strapiMetaDataC.fields,
  ...strapiPageDetailsC.fields,
});
export type DetailsRes = Schema.Schema.Type<typeof detailsResC>;

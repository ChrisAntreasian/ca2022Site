import { Schema } from "effect";
import { strapiBaseC, strapiDataArrC, strapiUpdatedC, withIdC } from "./strapi";

const imageBaseC = Schema.Struct({
  ext: Schema.String,
  height: Schema.Number,
  hash: Schema.String,
  mime: Schema.String,
  name: Schema.String,
  size: Schema.Number,
  url: Schema.String,
  width: Schema.Number,
  path: Schema.NullOr(Schema.String),
});

const imageAttrsC = Schema.extend(
  strapiUpdatedC,
  Schema.Struct({
    alternativeText: Schema.String,
    caption: Schema.String,
    provider: Schema.String,
    provider_metadata: Schema.Any,
    previewUrl: Schema.NullOr(Schema.String),
    url: Schema.String,
    formats: Schema.Union(
      Schema.Null,
      Schema.Struct({}),
      Schema.Struct({
        small: imageBaseC,
        medium: Schema.optional(imageBaseC),
        thumbnail: imageBaseC,
      }),
    ),
  }),
);

export const imageC = Schema.Union(imageBaseC, imageAttrsC);

export const strapiImageDataC = Schema.Struct({
  data: Schema.NullOr(withIdC(imageAttrsC)),
});

export type StrapiImageData = Schema.Schema.Type<typeof strapiImageDataC>;

export const artBaseC = Schema.extend(
  strapiBaseC,
  Schema.Struct({
    description: Schema.String,
    order: Schema.Number,
    image: strapiImageDataC,
  }),
);

export const artC = Schema.extend(
  artBaseC,
  Schema.Struct({
    title: Schema.String,
    createdDate: Schema.String,
    medium: Schema.String,
  }),
);

export const artWithIdC = withIdC(artC);
export type ArtWithId = Schema.Schema.Type<typeof artWithIdC>;

export const artCategoryC = Schema.extend(
  strapiBaseC,
  Schema.Struct({
    title: Schema.String,
    art_pieces: Schema.optional(strapiDataArrC(artC)),
    omit: Schema.optional(strapiDataArrC(Schema.Null)),
  }),
);

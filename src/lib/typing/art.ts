import * as t from "io-ts";
import { strapiBaseC, strapiDataArrC, strapiUpdatedC, withIdC } from "./strapi";

const imageBaseC = t.type({
	ext: t.string,
	height: t.number,
	hash: t.string,
	mime: t.string,
	name: t.string,
	size: t.number,
	url: t.string,
	width: t.number,
  path: t.union([t.string, t.null])
});

const imageAttrsC = t.intersection([
  strapiUpdatedC,
  t.type({
    alternativeText: t.string,
    caption: t.string,
    provider: t.string,
    provider_metadata: t.any,
    previewUrl: t.union([t.string, t.null]),
    url: t.string,
    formats: t.union([
      t.null,
      t.type({}),
      t.type({
        small: imageBaseC,
        medium: t.union([imageBaseC, t.undefined]),
        thumbnail: imageBaseC
      })
    ])
  })
]);

export const imageC = t.union([imageBaseC, imageAttrsC]);

export const strapiImageDataC = t.type({
	data: t.union([withIdC(imageAttrsC), t.null])
});

export type StrapiImageData = t.TypeOf<typeof strapiImageDataC>

export const artBaseC = t.intersection([
  t.any,
  strapiBaseC,
  t.type({
    description: t.string,
    order: t.number,
    image: strapiImageDataC
  })
]);

export const artC = t.intersection([
  artBaseC,
  t.type({
    title: t.string,
    createdDate: t.string,
    medium: t.string,
  })
]);

const artWithId = withIdC(artC);
export type ArtWithId = t.TypeOf<typeof artWithId>;

export const artCategoryC = t.intersection([
  strapiBaseC, 
  t.type({
    title: t.string,
    art_pieces: t.union([strapiDataArrC(artC), t.undefined]),
    omit:  t.union([strapiDataArrC(t.null), t.undefined])
  })
]);
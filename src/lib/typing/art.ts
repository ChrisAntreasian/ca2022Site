import * as t from "io-ts";
import { strapiBaseC, strapiDataArrC, withIdC } from "./strapi";

const imageBaseC = t.type({
	ext: t.string,
	height: t.number,
	hash: t.string,
	mime: t.string,
	name: t.string,
	size: t.number,
	url: t.string,
	width: t.number
});

const imageAttrsC = t.intersection([
  imageBaseC, 
  t.type({
    alternativeText: t.string,
    caption: t.string,
    provider: t.string,
    provider_metadata: t.any,
    previewUrl: t.any,
    formats: t.type({
      "small": imageBaseC,
      "medium": t.union([imageBaseC, t.undefined]),
      "thumbnail": imageBaseC
    })
  })
]);

export const strapiImageDataC = t.type({
	data: withIdC(imageAttrsC)
});

export type StrapiImageData = t.TypeOf<typeof strapiImageDataC>

export const artC = t.intersection([
  strapiBaseC,
  t.type({
    title: t.string,
    description: t.string,
    createdDate: t.string,
    medium: t.string,
    order: t.number,
    image: strapiImageDataC
  })
]);

export type ArtArt = t.TypeOf<typeof artC>

export const strapiArtC = strapiDataArrC(artC);

export const artCategoryC = t.intersection([
  strapiBaseC, 
  t.type({
    title: t.string,
    art_pieces: strapiArtC,
    omit: strapiDataArrC(t.type({ title: t.string, description: t.string })),
  })
]);
import * as t from "io-ts";

import { strapiBaseC, strapiDataArrC, strapiDataC } from "./strapi";
import { artC, artCategoryC, strapiArtC, strapiImageDataC } from "./art";
import { poemC } from "./poem";

const pageDetailsC = t.type({
  title: t.string,
  description: t.string,
  art_categories: strapiDataArrC(artCategoryC),
  poems: strapiDataArrC(poemC),
  link: t.string,
  art_piece: strapiDataC(artC),
  image: strapiImageDataC
});

const richLinkC = t.type({
	title: t.string,
	body: t.string,
	image: t.readonlyArray(strapiImageDataC),
	logo: strapiImageDataC,
	link: t.string,
	secondLink: t.string,
	position: t.number,
});

const strapiPageC = strapiDataC(t.intersection([
  strapiBaseC,
  t.type({
    title: t.string,
		art_pieces: strapiArtC,
		page_details: strapiDataArrC(pageDetailsC),
		rich_links: strapiDataArrC(richLinkC)
  })
]));

const strapiPageDetailsC = strapiDataArrC(pageDetailsC).props.data;


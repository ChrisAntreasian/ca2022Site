
import * as qs from "qs";

import { pipe, Effect } from "effect";
import { getNoOpts } from "$lib/api";

import { buildRes, combineResp, writeFile } from '$lib/build';

import type { PageServerLoad } from "./$types";
import { detailsResC, pageResC, type DetailsRes, type PageRes } from "$lib/typing/page";

const lq =  qs.stringify({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});

const pq =  qs.stringify({ 
  filters: { id: { $in: 1 } },
  populate: [
		"page_details",
		"page_details.art_categories",
		"page_details.poems",
		"page_details.art_piece",
		"page_details.art_piece.image",	
		"page_details.art_piece.image.media",
		"page_details.image.media",
	]
});

const getResL = getNoOpts(detailsResC)(`page-slugs?${lq}`);
const getResP =  getNoOpts(pageResC)(`pages?${pq}`);

const wf = () => pipe(
  Effect.all([
    Effect.flatMap(getResL, (data) => writeFile<DetailsRes>("layout")(data)),
    Effect.flatMap(getResP, (data) => writeFile<PageRes>("landing")(data))
  ], { concurrency: "unbounded" }),
  Effect.map(results => Array.from(results)),
  combineResp
)

export const load: PageServerLoad = async ({ params }) =>  
  await Effect.runPromise(buildRes("Layout & Landing", wf)(params.bid));



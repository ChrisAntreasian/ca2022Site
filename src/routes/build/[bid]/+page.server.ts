
import * as qs from "qs";

import { FN, TE, AP } from "$lib/fp-ts";
import { getNoOpts } from "$lib/api";

import { buildRes, combineResp, write } from '$lib/build';

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

const buildTupple = TE.chain(() => FN.pipe(
  [write<DetailsRes>("layout")(getResL), write<PageRes>("landing")(getResP)] as const,
  _ => AP.sequenceT(TE.ApplyPar)(..._),
));

const br1 = TE.chain(() => write<PageRes>("landing")(getResP));
const br2 = FN.flow(buildTupple, combineResp)

export const load: PageServerLoad = async ({ params }) => { 
  
  const w13 = buildRes("layout", br1)(params.bid)
  const z33 = buildRes("Layout & Landing", br2)(params.bid)
  
  return await z33();
}


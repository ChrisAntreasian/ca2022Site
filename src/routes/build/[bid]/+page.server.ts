
import * as qs from "qs";

import { 
	function as FN,
	taskEither as TE,
	apply as AP 
} from "fp-ts";
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

const buildTupple = TE.chain(() => FN.pipe(
  [writeFile<DetailsRes>("layout")(getResL), writeFile<PageRes>("landing")(getResP)] as const,
  x => AP.sequenceT(TE.ApplyPar)(...x),
));

const wf = FN.flow(buildTupple, combineResp)

export const load: PageServerLoad = async ({ params }) =>  
  await buildRes("Layout & Landing", wf)(params.bid)();



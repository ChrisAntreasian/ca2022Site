
import * as qs from "qs";

import { FN, TE, AP, T } from "$lib/fp-ts";
import { getNoOpts } from "$lib/api";

import { buildGate, buildResource, combineResp } from '$lib/build';

import type { PageServerLoad } from "./$types";
import { detailsResC, pageResC, type DetailsRes, type PageRes } from "$lib/typing/page";
import { throwErrIO } from "$lib/error";

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

const buildTupB = TE.chain(() => FN.pipe(
  [buildResource<DetailsRes>("layout")(getResL), buildResource<PageRes>("landing")(getResP)] as const,
  _ => AP.sequenceT(TE.ApplyPar)(..._),
));

const mapFn = <A>(out: A) => ({
  title: "Layout & Landing",
  data: out
});

export const load: PageServerLoad = async ({ params, route }) => { 
  
  const w12 = FN.pipe(
    params.bid,
    buildGate,
    TE.chain(() => buildResource("landing")(getResP)),
    TE.fold(throwErrIO(), FN.flow(mapFn, T.of))
  );

  const z22 = FN.pipe(
    params.bid, 
    buildGate,
    buildTupB,
    combineResp,
    TE.fold(throwErrIO(), FN.flow(mapFn, T.of)),
  );

  return await z22();
}


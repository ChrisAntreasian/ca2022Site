
import * as qs from "qs";

import { E, FN, TE, AP } from "$lib/fp-ts";
import { getNoOpts } from "$lib/api";

import { build, buildGate, fetchKey, type KeyData, writeFile } from '$lib/build';

import type { PageServerLoad } from "./$types";
import { detailsResC, type DetailsRes, type PageRes, pageResC } from "$lib/typing/page";

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

const mapFnL = (out: DetailsRes) => ({
  title: "Layout",
  data: out
});

const mapFnP = (out: PageRes) => ({
  title: "Landing",
  data: out
});

export const load: PageServerLoad = async ({ params, route }) => { 
  const buildL = build<DetailsRes, DetailsRes>(E.right("layout"), getResL, mapFnL);
  const buildP = build<PageRes, PageRes>(E.right("landing"), getResP, mapFnP);
  
  const fetchFns = [
    fetchKey(E.right("layout"), getResL), 
    fetchKey(E.right("landing"), getResP)
  ] as const;
  
  const buildFns: KeyData = FN.pipe(
    fetchFns,   
    bfk => AP.sequenceT(TE.ApplyPar)(...bfk),
  );


  FN.pipe(buildFns, writeFile)
  
  return await FN.pipe(
    params.bid, 
    buildGate,
    buildL
  )();

}
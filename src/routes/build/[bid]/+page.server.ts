
import * as qs from "qs";

import { E, FN, TE, AP, T, RA, RNEA } from "$lib/fp-ts";
import { getNoOpts } from "$lib/api";

import { buildGate, w1, w2d } from '$lib/build';

import type { PageServerLoad } from "./$types";
import { detailsResC, pageResC } from "$lib/typing/page";
import { throwErrIO } from "$lib/error";
import { writeFsTE2 } from "$lib/file";

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

const buildTup = TE.chain(() => FN.pipe(
  [getResL ,getResP] as const,
  _ => AP.sequenceT(TE.ApplyPar)(..._),
  TE.map(RA.zip(["layout", "landing"]))
));

const mapFn = <A>(out: A) => ({
  title: "Layout & Landing",
  data: out
});

export const load: PageServerLoad = async ({ params, route }) => { 
  
  // this is working
  const w11 = FN.pipe(
    params.bid,
    buildGate,
    w1(E.right("layout"), getResL),
    TE.fold(throwErrIO(), FN.flow(mapFn, T.of))
  );

  const w12 = FN.pipe(
    params.bid,
    buildGate,
    TE.chain(() => getResL),
    TE.map(_ => [_, "title"]),
    TE.map(writeFsTE2),
    TE.fold(throwErrIO(), FN.flow(mapFn, T.of))
  );

  const z22 = FN.pipe(
    params.bid, 
    buildGate,
    buildTup,
    w2d,
    TE.fold(throwErrIO(), FN.flow(mapFn, T.of)),
  );

  return await z22();
}


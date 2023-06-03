import type { PageServerLoad } from "./$types";

import type * as t from "io-ts";
import * as qs from "qs";

import { pipe } from 'fp-ts/lib/function';

import { getNoOpts } from "$lib/api";

import { build, buildGate } from '$lib/build';
import { mkKeyE } from '$lib/file';

import { strapiDataC } from "$lib/typing/strapi";
import { artCategoryC } from "$lib/typing/art";

const respC = strapiDataC(artCategoryC);
type Resp = t.TypeOf<typeof respC>

const q = qs.stringify({
	filters: {
		id: { $in: 3 },
	},
  populate: [
		"omit",
		"featured",
    "art_pieces",
    "art_pieces.image",
		"art_pieces.image.media",
  ],
});

const getRes = getNoOpts(respC)(`art-categories?${q}`);

const mapFn = (out: Resp) => ({
  title: "The Quintuplapus",
  data: out
});

export const load: PageServerLoad = async ({ params, route }) =>  await pipe(
  params.bid, 
  buildGate, 
  build<Resp, Resp>(mkKeyE(route.id), getRes, mapFn)
)();
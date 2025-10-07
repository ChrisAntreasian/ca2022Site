import type { PageServerLoad } from "./$types";

import { Schema, Effect } from "effect";
import * as qs from "qs";

import { getNoOpts } from "$lib/api";

import { buildRes, writeFile } from '$lib/build';
import { mkKeyWDefault } from '$lib/file';

import { strapiDataArrC, strapiMetaDataC } from "$lib/typing/strapi";
import { artCategoryC } from "$lib/typing/art";

const respC = Schema.extend(
  strapiMetaDataC, 
  strapiDataArrC(artCategoryC)
);
type Resp = Schema.Schema.Type<typeof respC>

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
const wf = (rid: string) => () => Effect.flatMap(getRes, (data) => writeFile<Resp>(mkKeyWDefault(rid))(data));

export const load: PageServerLoad = async ({ params, route }) => 
  await Effect.runPromise(buildRes("The Quintuplapus", wf(route.id))(params.bid));
  
import type { PageServerLoad } from "./$types";

import * as t from "io-ts";
import * as qs from "qs";

import { getNoOpts } from "$lib/api";

import { buildRes, writeFile } from '$lib/build';
import { mkKeyWDefault } from '$lib/file';

import { strapiDataArrC, strapiMetaDataC } from "$lib/typing/strapi";
import { artCategoryC } from "$lib/typing/art";
import { taskEither as TE } from "fp-ts";

const respC = t.intersection([strapiMetaDataC, strapiDataArrC(artCategoryC)]);
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
const wf = (rid: string) => TE.chain(() => writeFile<Resp>(mkKeyWDefault(rid))(getRes));

export const load: PageServerLoad = async ({ params, route }) => 
  await buildRes("The Quintuplapus", wf(route.id))(params.bid)();
  
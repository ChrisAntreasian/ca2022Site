import type { PageServerLoad } from "./$types";
import { mkKeyWDefault } from "$lib/file";
import * as t from "io-ts";
import { taskEither as TE } from "fp-ts";

import * as qs from "qs";

import { getNoOpts } from "$lib/api";
import { buildRes, writeFile } from '$lib/build';
import { strapiDataArrC, strapiMetaDataC } from "$lib/typing/strapi";
import { artBaseC } from "$lib/typing/art";

const respC = t.intersection([strapiMetaDataC, strapiDataArrC(artBaseC)]);
type Resp = t.TypeOf<typeof respC>;

const q = qs.stringify({
  populate: [
    "image",
		"image.media",
  ]
});

const getRes = getNoOpts(respC)(`soul-juices?${q}`);
const wf = (rid: string) => TE.chain(() => writeFile<Resp>(mkKeyWDefault(rid))(getRes));

export const load: PageServerLoad = async ({ params, route }) => 
  await buildRes("The SoulJuicer", wf(route.id))(params.bid)();
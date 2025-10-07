import type { PageServerLoad } from "./$types";
import { mkKeyWDefault } from "$lib/file";
import { Schema, Effect } from "effect";

import * as qs from "qs";

import { getNoOpts } from "$lib/api";
import { buildRes, writeFile } from '$lib/build';
import { strapiDataArrC, strapiMetaDataC } from "$lib/typing/strapi";
import { artBaseC } from "$lib/typing/art";

const respC = Schema.extend(
  strapiMetaDataC,
  strapiDataArrC(artBaseC)
);
type Resp = Schema.Schema.Type<typeof respC>;

const q = qs.stringify({
  populate: [
    "image",
		"image.media",
  ]
});

const getRes = getNoOpts(respC)(`soul-juices?${q}`);
const wf = (rid: string) => () => Effect.flatMap(getRes, (data) => writeFile<Resp>(mkKeyWDefault(rid))(data));

export const load: PageServerLoad = async ({ params, route }) => 
  await Effect.runPromise(buildRes("The SoulJuicer", wf(route.id))(params.bid));
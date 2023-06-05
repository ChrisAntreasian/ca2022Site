import type { PageServerLoad } from "./$types";

import * as t from "io-ts";
import * as qs from "qs";

import { pipe } from 'fp-ts/lib/function';

import { getNoOpts } from "$lib/api";
import { build, buildGate } from '$lib/build';
import { mkKeyE } from '$lib/file';
import { strapiPageC } from '$lib/typing/page';
import { strapiDataArrC, strapiMetaDataC } from '$lib/typing/strapi';

const respC = t.intersection([strapiMetaDataC, strapiDataArrC(strapiPageC)]);
type Resp = t.TypeOf<typeof respC>

const pq =  qs.stringify({ 
  filters: { id: { $in: 3 } },
  populate: [
		"page_details",
		"page_details.image.media",
		"rich_links",
    "rich_links.image.media",
    "rich_links.logo.media",
	]
});

const getRes = getNoOpts(respC)(`pages?${pq}`);

const mapFn = (data: Resp) => ({
  title: "Web Expereince",
  data
});

export const load: PageServerLoad = async ({ params, route }) =>  await pipe(
  params.bid, 
  buildGate, 
  build<Resp, Resp>(mkKeyE(route.id), getRes, mapFn)
)();
import type { PageServerLoad } from "./$types";

import type * as t from "io-ts";
import * as qs from "qs";

import { pipe } from 'fp-ts/lib/function';

import { getNoOpts } from "$lib/api";
import { build, buildGate } from '$lib/build';
import { mkKeyE } from '$lib/file';
import { pageResC, type PageRes } from '$lib/typing/page';

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

const getRes = getNoOpts(pageResC)(`pages?${pq}`);

const mapFn = (data: PageRes) => ({
  title: "Web Expereince",
  data
});

export const load: PageServerLoad = async ({ params, route }) =>  await pipe(
  params.bid, 
  buildGate, 
  build<PageRes, PageRes>(mkKeyE(route.id), getRes, mapFn)
)();
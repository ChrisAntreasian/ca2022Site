import type { PageServerLoad } from "./$types";

import * as qs from "qs";

import { getNoOpts } from "$lib/api";
import { buildRes, writeFile } from '$lib/build';
import { mkKeyWDefault } from '$lib/file';
import { pageResC, type PageRes } from '$lib/typing/page';
import { taskEither as TE } from "fp-ts";

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
const wf = (rid: string) => TE.chain(() => writeFile<PageRes>(mkKeyWDefault(rid))(getRes));

export const load: PageServerLoad = async ({ params, route }) => 
  await buildRes("Web Expereince", wf(route.id))(params.bid)();
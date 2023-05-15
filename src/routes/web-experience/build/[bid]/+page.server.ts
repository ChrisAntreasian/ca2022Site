import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";
import { mkKey, writeFs } from "$lib/file";

import { handleGetResponse, mkRequest, queryStr } from "$lib/api";
import type { StrapiPage, StrapiRichLink } from '$lib/types';

const pq =  queryStr({ 
  filters: { id: { $in: 3 } },
  populate: [
		"page_details",
		"page_details.image.media",
		"rich_links",
    "rich_links.image.media",
    "rich_links.logo.media",
	]
});
const fetchData = async () => {
  const response = await mkRequest("GET", `pages?${pq}`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params, route }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const res = await fetchData();
  if (res.ok) {
    const out: StrapiPage = await res.json()
    const data = await writeFs<StrapiPage>(mkKey(route.id), out);

    return {
      title: "Web Expereince",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
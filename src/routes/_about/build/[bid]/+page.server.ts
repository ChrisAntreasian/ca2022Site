import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";
import { writeFs } from "$lib/file";

import { handleGetResponse, mkRequest, queryStr } from "$lib/api";

import type { StrapiPage } from '$lib/types';

const q =  queryStr({ 
  filters: { id: { $in: 2 } },
  populate: [
		"rich_links",
		"rich_links.image",
		"rich_links.image.media",
		"page_details",
		"page_details.image.media",
		"art_pieces",
		"art_pieces.image",
		"art_pieces.image.media",
	]
});

const fetchData = async () => {
  const response = await mkRequest("GET", `pages?${q}`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const res = await fetchData();
  if (res.ok) {
    const out: StrapiPage = await res.json()
    const data = await writeFs<StrapiPage>("about", out);

    return {
      title: "About",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
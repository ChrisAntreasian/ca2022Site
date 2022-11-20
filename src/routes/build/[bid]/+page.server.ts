import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";
import { writeFs } from "$lib/file";

import { handleGetResponse, mkRequest, queryStr } from "$lib/api";

import type { PageDetails, StrapiApiResp, StrapiPage } from '$lib/types';

const lq =  queryStr({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});

const pq =  queryStr({ 
  filters: { id: { $in: 1 } },
  populate: [
		"page_details",
		"page_details.art_categories",
		"page_details.poems",
		"page_details.art_piece",
		"page_details.art_piece.image",	
		"page_details.art_piece.image.media",
		"page_details.image.media",
	]
});

const fetchData = async (p: string) => {
  const response = await mkRequest("GET", p);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;
let data = {};

export const load: PageServerLoad = async ({ params }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const resL = await fetchData(`page-slugs?${lq}`);
  if (resL.ok) {
    const outL: StrapiApiResp<PageDetails> = await resL.json()
    const dataL = await writeFs<StrapiApiResp<PageDetails>>("layout", outL);
    data = {...data, ...dataL}
  }

  const resP = await fetchData(`pages?${pq}`);
  if (resP.ok) {
    const outP: StrapiPage = await resP.json()
    const dataP = await writeFs<StrapiPage>("landing", outP);
    data = {...data, ...dataP};
  }

  if (resP.ok && resL.ok) {
    return {
      title: "Layout & Landing",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
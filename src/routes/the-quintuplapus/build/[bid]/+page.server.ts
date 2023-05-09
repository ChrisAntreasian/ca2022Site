import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";
import { mkKey, writeFs } from "$lib/file";

import { handleGetResponse, mkRequest } from "$lib/api";

import * as qs from "qs";
import type { ArtCategory, StrapiData } from '$lib/types';

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

const fetchData = async () => {
  const response = await mkRequest("GET", `art-categories?${q}`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params, route }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const res = await fetchData();
  if (res.ok) {
    const out: StrapiData<ArtCategory> = await res.json()
    const data = await writeFs<StrapiData<ArtCategory>>(mkKey(route.id), out);

    return {
      title: "The Quintuplapus",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
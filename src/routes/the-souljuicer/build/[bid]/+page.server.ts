import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";
import { mkKey, writeFs } from "$lib/file";

import { handleGetResponse, mkRequest } from "$lib/api";

import * as qs from "qs";
import type { StrapiArtCategory } from '$lib/types';

const q = qs.stringify({

  populate: [
    "image",
		"image.media",
  ],
});
const fetchData = async () => {
  const response = await mkRequest("GET", `soul-juices?${q}`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params, route }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const res = await fetchData();
  if (res.ok) {
    const out = await res.json()
    const data = await writeFs(mkKey(route.id), out);
    console.log(data, out)
    return {
      title: "The SoulJuicer",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
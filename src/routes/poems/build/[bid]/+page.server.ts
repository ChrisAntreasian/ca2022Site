import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";

import { getNoOpts, handleGetResponse, mkRequest } from "$lib/api";

import { strapiPoemC, type StrapiPoem } from '$lib/types';

const fetchData = async () => {
  const response = await mkRequest("GET", `poems`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params, route }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }
  const poemH = await getNoOpts(strapiPoemC)("poems")();
  console.log("PoemH", poemH)
  const res = await fetchData();
  if (res.ok) {
    const out: StrapiPoem = await res.json()
    // const data = await writeFs<StrapiPoem>(mkKey(route.id), out);
    return {
      title: "Poems",
      data: out
    }; 
  }

  throw error(500, "Failed to save the data.")
}
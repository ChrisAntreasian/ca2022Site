import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";
import { writeFs } from "$lib/file";

import { handleGetResponse, mkRequest } from "$lib/api";

import type { StrapiPoem } from '$lib/types';


export const fetchData = async () => {
  const response = await mkRequest("GET", `poems`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const res = await fetchData();
  if (res.ok) {
    const out: StrapiPoem = await res.json()
    const data = await writeFs<StrapiPoem>("poems", out);

    return {
      title: "Poems",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
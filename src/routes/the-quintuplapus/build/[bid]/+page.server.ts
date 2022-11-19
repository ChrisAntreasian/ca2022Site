import { error } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";

import { writeFs } from "$lib/file";
import { fetchData } from "../../_modules/api";

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

export const load: PageServerLoad = async ({ params }) => {
  if (params.bid !== VITE_BUILD_KEY || VITE_ENV !== "develop" ) {
    throw error(403, "Permission denied.");
  }

  const res = await fetchData();
  if (res.ok) {
    const out = await res.json()
    const data = await writeFs("quintuplapus", out);

    return {
      title: "The Quintuplapus",
      data
    }; 
  }

  throw error(500, "Failed to save the data.")
}
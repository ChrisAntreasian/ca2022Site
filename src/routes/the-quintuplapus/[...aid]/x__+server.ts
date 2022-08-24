import qs from "qs";
import { api, handleGetResponse } from "$lib/api";
import type { RequestHandler } from "../../../../.svelte-kit/types/src/routes/the-quintuplapus.json/$types";

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

export const GET: RequestHandler = async () => {
	const response = await api("GET", `art-categories?${q}`);
	return handleGetResponse(response);
};
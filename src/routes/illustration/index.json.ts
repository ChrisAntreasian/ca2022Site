import qs from "qs";
import { api } from "../../lib/api";
import type { RequestHandler } from "@sveltejs/kit";
import type { Locals } from "$lib/types";

const q = qs.stringify({
	filters: {id: { $in: 1 }},
  populate: [
		"omit",
		"featured",
    "art_pieces",
    "art_pieces.image",
		"art_pieces.image.media",
  ]
});

export const get: RequestHandler<Locals> = async (request) => {
	const response = await api(request.request.method, `art-categories?${q}`);
	if (response.status === 404) {
		return { body: [] };
	}

	return response;
};

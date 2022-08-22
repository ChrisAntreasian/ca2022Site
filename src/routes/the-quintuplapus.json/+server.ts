
// @migration task: Check imports
import qs from "qs";
import { api } from "$lib/api";
import type { RequestHandler } from "@sveltejs/kit";

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

export const GET: RequestHandler<{}> = async (request) => {
	const response = await api(request.request.method, `art-categories?${q}`);
	if (response.status === 404) {
		throw new Error("@migration task: Migrate this return statement (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292701)");
		// Suggestion (check for correctness before using):
		// return new Response([]);
		return { body: [] };
	}

	throw new Error("@migration task: Migrate this return statement (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292701)");
	return response;
};

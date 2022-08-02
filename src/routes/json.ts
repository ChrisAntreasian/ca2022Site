import { api, queryStr } from "$api/api";
import type { RequestHandler } from "@sveltejs/kit";

const pQ =  queryStr({ 
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

export const get: RequestHandler<{}> = async (request) => {
	const r = await api(request.request.method, `pages?${pQ}`);
	return r;
};

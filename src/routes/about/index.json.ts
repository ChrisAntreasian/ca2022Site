import { api, queryStr } from "$api/api";
import type { RequestHandler } from "@sveltejs/kit";

const pQ =  queryStr({ 
  filters: { id: { $in: 2 } },
  populate: [
		"rich_links",
		"rich_links.image",
		"rich_links.image.media",
		"page_details",
		"page_details.image.media",
		"art_pieces",
		"art_pieces.image",
		"art_pieces.image.media",
	]
});

export const get: RequestHandler<{}> = async (request) => {
	const r = await api(request.request.method, `pages?${pQ}`);
	return r;
};

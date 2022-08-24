import { api, handleGetResponse, queryStr } from "$lib/api";
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

export const GET: RequestHandler = async () => {
	const response = await api("GET", `pages?${pQ}`);
	return handleGetResponse(response);
};
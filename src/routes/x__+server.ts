import { api, handleGetResponse, queryStr } from "$lib/api";
import type { RequestHandler } from '../../.svelte-kit/types/src/routes/json/$types';

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

export const GET: RequestHandler = async () => {
	const response = await api("GET", `pages?${pQ}`);
	return handleGetResponse(response);
};

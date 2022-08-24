import { api, handleGetResponse, queryStr } from "$lib/api";
import type { RequestHandler } from "@sveltejs/kit";

const pQ =  queryStr({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});

export const GET: RequestHandler<{}> = async () => {
	const response = await api("GET", `page-slugs?${pQ}`);
	console.log(response.body)
	return handleGetResponse(response);
};

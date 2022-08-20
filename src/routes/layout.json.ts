import { api, queryStr } from "$lib/api";
import type { RequestHandler } from "@sveltejs/kit";

const pQ =  queryStr({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});
export const GET: RequestHandler<{}> = async (request) => {
	const response = await api(request.request.method, `page-slugs?${pQ}`);
	if (response.status === 404) {
		return { body: [] };
	}

	return response;
};

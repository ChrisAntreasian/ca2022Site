import { api, queryStr } from "../lib/api";
import type { RequestHandler } from "@sveltejs/kit";
import type { Locals } from "$lib/types";

const q = queryStr({ 
  filters: { id: { $in: 1 } },
  populate: "*"
});
export const get: RequestHandler<Locals> = async (request) => {
	console.log("hit")
	const response = await api(request.request.method, `art-pieces?${q}`);
	if (response.status === 404) {
		return { body: [] };
	}

	return response;
};

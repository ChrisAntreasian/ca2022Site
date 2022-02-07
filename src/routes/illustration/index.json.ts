import { api } from "../_api";
import type { RequestHandler } from "@sveltejs/kit";
import type { Locals } from "$lib/types";

export const get: RequestHandler<Locals> = async (request) => {
	const response = await api(request, `art-pieces?populate=*`);
	if (response.status === 404) {
		return { body: [] };
	}

	return response;
};

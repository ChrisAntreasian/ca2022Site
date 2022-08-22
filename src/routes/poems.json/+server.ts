
// @migration task: Check imports
import { api } from '$lib/api';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler<{}> = async (request) => {
	const response = await api(request.request.method, `poems`);
	if (response.status === 404) {
		throw new Error("@migration task: Migrate this return statement (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292701)");
		// Suggestion (check for correctness before using):
		// return new Response([]);
		return { body: [] };
	}

	throw new Error("@migration task: Migrate this return statement (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292701)");
	return response;
};

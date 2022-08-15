import { api } from '$lib/api';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler<{}> = async (request) => {
	const response = await api(request.request.method, `poems`);
	if (response.status === 404) {
		return { body: [] };
	}

	return response;
};

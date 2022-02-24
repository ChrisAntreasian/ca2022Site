import { api } from '../../lib/api';
import type { RequestHandler } from '@sveltejs/kit';
import type { Locals } from '$lib/types';

export const get: RequestHandler<Locals> = async (request) => {
	const response = await api(request.request.method, `poems`);
	console.log(response)
	if (response.status === 404) {
		return { body: [] };
	}

	return response;
};

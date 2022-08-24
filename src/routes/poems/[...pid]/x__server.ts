import { api, handleGetResponse } from '$lib/api';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler<{}> = async () => {
	const response = await api("GET", `poems`);
	return handleGetResponse(response);
};
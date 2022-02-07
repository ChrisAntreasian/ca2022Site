import type { EndpointOutput, Request } from '@sveltejs/kit';
import type { Locals } from '$lib/types';

export const apiBaseUrl = 'http://localhost:1337';

export async function api(
	request: Request<Locals>,
	resource: string,
	data?: Record<string, unknown>
): Promise<EndpointOutput> {
	// user must have a cookie set
	if (!request.locals.userid) {
		return { status: 401 };
	}

	const res = await fetch(`${apiBaseUrl}/api/${resource}`, {
		method: request.method,
		headers: {
			'content-type': 'application/json'
		},
		body: data && JSON.stringify(data)
	});

	return {
		status: res.status,
		body: await res.json()
	};
}

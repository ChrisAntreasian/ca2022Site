

import qs from "qs";

type QuryProps = {
	filters?: Record<string, any>,
	populate?: string | string[]
} 

export const baseApi = import.meta.env.VITE_BASE_API;
export const s3Bucket = import.meta.env.VITE_S3_BUCKET;

export const queryStr = (_: QuryProps) => qs.stringify(_, { encodeValuesOnly: true });

export const api = (method: string, resource: string, data?: Record<string, unknown>) =>
	fetch(`${baseApi}/api/${resource}`, {
		method,
		headers: {
			'content-type': 'application/json'
		},
		body: data && JSON.stringify(data)
	});

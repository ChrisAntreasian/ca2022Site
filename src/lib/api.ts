

import { error } from "@sveltejs/kit";
import * as qs from "qs";

type QuryProps = {
	filters?: Record<string, any>,
	populate?: string | string[]
} 

export const baseApi = import.meta.env.VITE_BASE_API;
export const s3Bucket = import.meta.env.VITE_S3_BUCKET;

export const queryStr = (_: QuryProps) => qs.stringify(_, { encodeValuesOnly: true });

export const api = async (method: "GET" | "POST", resource: string, data?: Record<string, unknown>) => {
	const d = await fetch(`${baseApi}/api/${resource}`, {
		method,
		headers: {
			'content-type': 'application/json'
		},
		body: data && JSON.stringify(data)
	});
	return d;
}

export const handleGetResponse = async (response: Response) => {
	if (response.status === 404) {
		throw error(404, "Not Found");
	}

	const resp = await response.json()
	return new Response(JSON.stringify(resp), {
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
	});
}

export const captureDetails = (
	{ id, name }: { id:number, name: string }, 
	d: Record<string, string> = {}
) => ({
	...d,
	page: "The Quintuplapus",
	resourceId: id,
	resourceName: name
});

export const captureBehavior = async (eKey: string, props: any) => {
	await fetch('/api/mixpanel', {
		method: 'POST',
		body: JSON.stringify({ eKey, props }),
		headers: {
			'content-type': 'application/json'
		}
	});
}
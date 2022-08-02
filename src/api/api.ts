
import qs from "qs";
import { apiBaseUrl } from "./api.config"

type QuryProps = {
	filters?: Record<string, any>,
	populate?: string | string[]
} 

export const queryStr = (_: QuryProps) => qs.stringify(_, { encodeValuesOnly: true });

export const api = (method: string, resource: string, data?: Record<string, unknown>) =>
	fetch(`${apiBaseUrl}/api/${resource}`, {
		method,
		headers: {
			'content-type': 'application/json'
		},
		body: data && JSON.stringify(data)
	});

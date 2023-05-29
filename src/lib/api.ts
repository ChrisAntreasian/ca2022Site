import { error } from "@sveltejs/kit";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";

import * as qs from "qs";
import * as TE from "fp-ts/TaskEither"
type QuryProps = {
	filters?: Record<string, any>,
	populate?: string | string[]
} 

export const baseApi = import.meta.env.VITE_BASE_API;

export const queryStr = (_: QuryProps) => qs.stringify(_, { encodeValuesOnly: true });

const fetchRequestB =  (
	urlBase: string
) => (
	method: "GET" | "POST", 
	data: O.Option<Record<string, unknown>>
) => async (resource: string) => await pipe(
	TE.tryCatch(
		() => fetch(`${urlBase}/api/${resource}`, {
			method,
			headers: { "content-type": "application/json" },
			body: pipe(data, O.getOrElseW(() => null))
		}),
		e => new Error(`Server Request Failed`),
	),
	TE.getOrElse(e => {
		throw error(500, e)
	})
)()

export const mkRequestB = fetchRequestB(baseApi);

const fetchRequest = (urlBase: string) => async (method: "GET" | "POST", resource: string, data?: Record<string, unknown>) => {
	const d = await fetch(`${urlBase}/api/ {resource}`, {
		method,
		headers: {
			'content-type': 'application/json'
		},
		body: data && JSON.stringify(data)
	});
	return d;
}
export const mkRequest = fetchRequest(baseApi);

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
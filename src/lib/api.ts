import { error, type HttpError } from "@sveltejs/kit";
import * as qs from "qs";

import { flow, pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither"

import type * as t from "io-ts";

type HTTPMethods = "GET" | "POST";
type QuryProps = {
	filters?: Record<string, any>,
	populate?: string | string[]
} 

const baseApi = import.meta.env.VITE_BASE_API;
const requestHeader = { headers: { 'content-type': 'application/json' }};

const fetchRequest = (urlBase: string) => async (method: "GET" | "POST", resource: string, data?: Record<string, unknown>) => {
	const d = await fetch(`${urlBase}/api/${resource}`, {
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

	const resp = await response.json();
	return new Response(JSON.stringify(resp), {
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
	});
}

type FetchInit = {
	headers: { 'content-type': string; };
	method: HTTPMethods;
	body: any;
}

const toJSON = async (_: Response) => await _.json();

const init = (method: HTTPMethods) => (data: O.Option<Record<string, unknown>>) => ({
	headers: { 'content-type': 'application/json; charset=utf-8' },
	method: method,
	body: pipe(data, O.map(JSON.stringify), O.toUndefined)
});

const get = init("GET");

const request = (urlBase: string, init: FetchInit) => (resource: string) => TE.tryCatch(
	() => fetch(`${urlBase}/api/${resource}`, init),
	() => error(500, "Server Request Failed")
);

const decode = <A>(codec: t.Type<A>): (res: unknown) => TE.TaskEither<HttpError, A> => flow(
	codec.decode,
	TE.fromEither,
	TE.mapLeft(() => error(500, "Data And Codec Didn't Match"))
);

const parse =  <A>(codec: t.Type<A>) => (init: FetchInit ) => flow(
	request(baseApi, init), 
	TE.filterOrElse(_ => _.status !== 404, () => error(404, "Not Found")),
	TE.chain(_ => TE.tryCatch(() => toJSON(_), () => error(500, "Faild To Parse JSON"))),
	TE.chain(decode(codec))
);

export const getNoOpts = <A>(codec: t.Type<A>) =>pipe(O.none, get, parse(codec));
export type GetNoOpts = <A>(codec: t.Type<A, A, unknown>) => (resource: string) => TE.TaskEither<HttpError, A>
export const queryStr = (_: QuryProps) => qs.stringify(_, { encodeValuesOnly: true });

import { error, type HttpError } from "@sveltejs/kit";
import { flow, pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as qs from "qs";
import * as TE from "fp-ts/TaskEither"
import { strapiPoemC, type StrapiPoem } from "./types";

type HTTPMethods = "GET" | "POST";
type QuryProps = {
	filters?: Record<string, any>,
	populate?: string | string[]
} 

export const baseApi = import.meta.env.VITE_BASE_API;

export const queryStr = (_: QuryProps) => qs.stringify(_, { encodeValuesOnly: true });

const requestHeader = { headers: { 'content-type': 'application/json' }};

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

type FetchInit = {
	headers: { 'content-type': string; };
	method: HTTPMethods;
	body: any;
}

const decodeResponse = (codec?: any): (res: unknown) => TE.TaskEither<HttpError, StrapiPoem> =>
	flow(
		strapiPoemC.decode,
		TE.fromEither, 
		TE.mapLeft(() => error(500, "Data and Codec did not match!"))
	);

const mkFetchInit = (method: HTTPMethods) => (data: O.Option<Record<string, unknown>>) => ({
	headers: { 'content-type': 'application/json; charset=utf-8' },
	method: method,
	body: pipe(data, O.getOrElseW(() => null))
});

const mkGetInit: (_: O.Option<Record<string, unknown>>) => FetchInit = flow(mkFetchInit("GET"));
const setHeaders = _ => new Response(_, requestHeader);

const fetchRequestB = (urlBase: string) => (fetchInit: FetchInit) => (resource: string) => TE.tryCatch(
		() => fetch(`${urlBase}/api/${resource}`, fetchInit),
		() => error(500, "Server Request Failed")
);

const mkRequestB = (fetchInit: FetchInit ) => flow(
	fetchRequestB(baseApi)(fetchInit), 
	TE.filterOrElse(_ => _.status === 404, () => error(404, "Not Found")),
	TE.map(_ => pipe(_.json, T.of, JSON.stringify, setHeaders)),
	TE.filterOrElse(_ => _.ok, () => error(500, "Data Not Ok")),
	TE.chain(decodeResponse()),
);

export const getNoOptions = pipe(O.none, mkGetInit, mkRequestB);

import { error, type HttpError } from "@sveltejs/kit";
import * as qs from "qs";
import { function as FN, option as O, taskEither as TE } from "fp-ts";

import type * as t from "io-ts";

type HTTPMethods = "GET" | "POST";

type QuryProps = {
  filters?: Record<string, unknown>;
  populate?: string | string[];
};

type FetchInit = {
  headers: { "content-type": string };
  method: HTTPMethods;
  body: Record<string, unknown>;
};

const baseApi = import.meta.env.VITE_BASE_API;

const toJSON = async (res: Response) => await res.json();

const init =
  (method: HTTPMethods) => (data: O.Option<Record<string, unknown>>) => ({
    headers: { "content-type": "application/json; charset=utf-8" },
    method: method,
    body: FN.pipe(data, O.map(JSON.stringify), O.toUndefined),
  });

const get = init("GET");

const request = (urlBase: string, init: FetchInit) => (resource: string) =>
  TE.tryCatch(
    () => fetch(`${urlBase}/api/${resource}`, init),
    () => error(500, "Server Request Failed"),
  );

const decode = <A>(
  codec: t.Type<A>,
): ((res: unknown) => TE.TaskEither<HttpError, A>) =>
  FN.flow(
    codec.decode,
    TE.fromEither,
    TE.mapLeft(() => error(500, "Data Did Not Match The Codec")),
  );

const parse =
  <A>(codec: t.Type<A>) =>
  (init: FetchInit) =>
    FN.flow(
      request(baseApi, init),
      TE.filterOrElse(
        (res) => res.status !== 404,
        () => error(404, "Not Found"),
      ),
      TE.chain((res) =>
        TE.tryCatch(
          () => toJSON(res),
          () => error(500, "Faild To Parse JSON"),
        ),
      ),
      TE.chain(decode(codec)),
    );

export const getNoOpts = <A>(codec: t.Type<A>) =>
  FN.pipe(O.none, get, parse(codec));
export const queryStr = (p: QuryProps) =>
  qs.stringify(p, { encodeValuesOnly: true });
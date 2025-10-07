import { error, type HttpError } from "@sveltejs/kit";
import * as qs from "qs";
import { Effect, pipe, flow } from "effect";
import { Schema } from "effect";

type QueryProps = {
  filters?: Record<string, unknown>;
  populate?: string | string[];
};

const baseApi = import.meta.env.VITE_BASE_API;

const toJSON = async (res: Response) => await res.json();



const decode = <A>(
  schema: Schema.Schema<A, unknown>,
): ((res: unknown) => Effect.Effect<A, HttpError>) =>
  flow(
    Schema.decodeUnknown(schema),
    Effect.mapError(() => error(500, "Data Did Not Match The Schema") as HttpError),
  );

const parseResponse = <A>(schema: Schema.Schema<A, unknown>) => (resource: string) =>
  pipe(
    Effect.tryPromise({
      try: () => fetch(`${baseApi}/api/${resource}`, {
        headers: { "content-type": "application/json; charset=utf-8" },
        method: "GET",
      }),
      catch: () => error(500, "Server Request Failed") as HttpError,
    }),
    Effect.flatMap((res) => {
      if (res.status === 404) {
        return Effect.fail(error(404, "Not Found") as HttpError);
      }
      return Effect.tryPromise({
        try: () => toJSON(res),
        catch: () => error(500, "Failed To Parse JSON") as HttpError,
      });
    }),
    Effect.flatMap(decode(schema)),
  );

export const getNoOpts = <A>(schema: Schema.Schema<A, unknown>) =>
  parseResponse(schema);

export const queryStr = (p: QueryProps) =>
  qs.stringify(p, { encodeValuesOnly: true });
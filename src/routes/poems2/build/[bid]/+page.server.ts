import { error, type HttpError } from '@sveltejs/kit';
import type { PageServerLoad } from "./$types";

import { getNoOpts, handleGetResponse, mkRequest } from "$lib/api";

import { strapiPoemC, type StrapiPoem } from '$lib/types';
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";

import { flow, pipe } from 'fp-ts/lib/function';
const fetchData = async () => {
  const response = await mkRequest("GET", `poems`);
	return await handleGetResponse(response);
}

const { VITE_BUILD_KEY, VITE_ENV } = import.meta.env;

const buildGate = (bid: string) => <A>(fetchFn: TE.TaskEither<HttpError, A>) => pipe(
  bid,
  E.fromPredicate(
    (_: string) => _ !== VITE_BUILD_KEY || VITE_ENV !== "develop", 
    () => error(403, "Permission denied.")
  ),
  TE.fromEither,
  TE.chain(() => fetchFn),
);

export const load: PageServerLoad = async ({ params, route }) => {
  buildGate(params.bid)<StrapiPoem>(getNoOpts(strapiPoemC)("poems"))
 
  const poemH = await getNoOpts(strapiPoemC)("poems")();
  console.log("PoemH", poemH)
  const res = await fetchData();
  if (res.ok) {
    const out: StrapiPoem = await res.json()
    // const data = await writeFs<StrapiPoem>(mkKey(route.id), out);
    return {
      title: "Poems",
      data: out
    }; 
  }

  throw error(500, "Failed to save the data.")
}
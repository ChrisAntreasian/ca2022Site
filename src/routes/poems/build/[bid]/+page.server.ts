import type { PageServerLoad } from "./$types";

import { Effect } from "effect";
import { getNoOpts } from "$lib/api";
import { strapiPoemC, type StrapiPoem } from "$lib/typing/poem";
import { buildRes, writeFile } from '$lib/build';

const getPoems = getNoOpts(strapiPoemC)("poems");
const wf = () => Effect.flatMap(getPoems, (data) => writeFile<StrapiPoem>("poems")(data));

export const load: PageServerLoad = async ({ params }) => 
  await Effect.runPromise(buildRes("Poems", wf)(params.bid));
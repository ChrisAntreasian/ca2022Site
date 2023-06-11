import type { PageServerLoad } from "./$types";

import { getNoOpts } from "$lib/api";
import { strapiPoemC, type StrapiPoem } from "$lib/typing/poem";
import { buildRes, writeFile } from '$lib/build';
import { TE } from "$lib/fp-ts";

const getPoems = getNoOpts(strapiPoemC)("poems");
const wf = TE.chain(() => writeFile<StrapiPoem>("poems")(getPoems));

export const load: PageServerLoad = async ({ params }) => 
  await buildRes("Poems", wf)(params.bid)();
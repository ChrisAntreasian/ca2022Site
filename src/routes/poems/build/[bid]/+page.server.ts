import type { PageServerLoad } from "./$types";
import { pipe } from 'fp-ts/lib/function';

import { getNoOpts } from "$lib/api";

import { strapiPoemC, type StrapiPoem } from "$lib/typing/poem";
import { build, buildGate } from '$lib/build';
import { mkKeyE } from '$lib/file';

const getPoems = getNoOpts(strapiPoemC)("poems");

const mapFn = (out: StrapiPoem) => ({
  title: "Poems",
  data: out
});

export const load: PageServerLoad = async ({ params, route }) =>  await pipe(
  params.bid, 
  buildGate, 
  build<StrapiPoem, StrapiPoem>(mkKeyE(route.id), getPoems, mapFn)
)();
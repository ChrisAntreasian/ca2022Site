import type { PageServerLoad } from "./$types";
import { pipe } from 'fp-ts/lib/function';

import { getNoOpts } from "$lib/api";

import { strapiPoemC, type StrapiPoem } from '$lib/types';
import { build, buildGate } from '$lib/build';
import { mkKeyB } from '$lib/file';

const getPoems = getNoOpts(strapiPoemC)("poems");

const mapFn = (out: StrapiPoem) => ({
  title: "Poems",
  data: out
});

export const load: PageServerLoad = async ({ params, route }) =>  await pipe(
  params.bid, 
  buildGate, 
  build<StrapiPoem, StrapiPoem>(mkKeyB(route.id), getPoems, mapFn)
)();
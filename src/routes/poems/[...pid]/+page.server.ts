import type { Poem, WithId } from '$lib/types';
import type { PageServerLoad } from './$types';
import * as D from "$data/poems.json"
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as n from "fp-ts/number"
import * as TE from "fp-ts/TaskEither";

import * as s from "fp-ts/string"
import { randomArrItem } from '$lib/array';
import { contramap } from "fp-ts/Ord"

const positionOrd = pipe(
  n.Ord,
  contramap((d: WithId<Poem>) => d.attributes.position)
);

export const load: PageServerLoad = async ({ params }) => pipe(
	D.data,
	d => ({
		poems: {meta: d.meta, data: pipe(d.data, RA.sortBy([positionOrd]))},
		poem: pipe(
			pipe(params.pid, s.split("/"), _ => _[0]),
			O.fromPredicate(_ => !s.isEmpty(_)),
			O.fold(() => pipe(d.data, randomArrItem, _=> _.id), parseInt),
			idx => pipe(d.data, RA.findFirst(_ => _.id === idx)),
			O.getOrElse(() => d.data[0])
		)
	}),
);
import type { Poem, WithId } from '$lib/types';
import type { PageServerLoad } from './$types';
import * as D from "$data/poems.json"

export const load: PageServerLoad = async ({ params }) => {
	const d = D.data;
	const pid = parseInt(params.pid) || d.data[Math.floor(Math.random() * d.data.length)].id;
	d.data.map(_ => _.id)
	const poem = d.data.filter((_: WithId<Poem>) => _.id === pid)[0];

	return {
		poems: d,
		poem
	};
};

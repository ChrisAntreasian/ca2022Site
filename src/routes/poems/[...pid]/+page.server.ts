import type { Poem, WithId } from '$lib/types';
import type { PageServerLoad } from './$types';
import * as D from "$data/poems.json"

export const load: PageServerLoad = async ({ params }) => {
	const d = D.data;
	const pid = parseInt(params.pid) || d.data[Math.floor(Math.random() * d.data.length)].id;
	const poem = d.data.filter((_: WithId<Poem>) => _.id === pid)[0];
	console.log({...d, data: d.data.sort((a, b) => a.attributes.position - b.attributes.position)})
	return {
		poems: {...d, data: d.data.sort(_ => _.attributes.position)},
		poem
	};
};

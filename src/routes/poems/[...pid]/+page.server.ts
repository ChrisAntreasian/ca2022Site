import type { Poem, StrapiPoem, WithId } from '$lib/types';
import type { PageServerLoad } from './$types';
// import { readData, dataKey } from '$lib/file';
import * as D from "$data/poems.json"

export const load: PageServerLoad = async ({ params, routeId }) => {
	const d = D.data; //await readData<StrapiPoem>(dataKey(routeId));

	const pid = parseInt(params.pid) || 5;
	const poem = d.data.filter((_: WithId<Poem>) => _.id === pid)[0];
	
	return { 
		poems: d,
		poem
	};	
};

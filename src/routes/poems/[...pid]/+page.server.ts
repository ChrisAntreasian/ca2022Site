import type { Poem, WithId } from '$lib/types';
import type { PageServerLoad } from './$types';
import * as D from "$data/poems.json"

export const load: PageServerLoad = async ({ params }) => {
	
		const pid = parseInt(params.pid) || 5;
		const poems= D.data;
		const poem = poems.data.filter((_: WithId<Poem>) => _.id === pid)[0];
		
		return { 
			poems,
			poem
		};
	
};

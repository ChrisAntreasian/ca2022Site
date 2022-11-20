import type { Poem, StrapiPoem, WithId } from '$lib/types';
import type { PageServerLoad } from './$types';
import { readData } from '$lib/file';

export const load: PageServerLoad = async ({ params }) => {
	const d = await readData<StrapiPoem>("poems");

	const pid = parseInt(params.pid) || 5;
	const poem = d.data.filter((_: WithId<Poem>) => _.id === pid)[0];
	
	return { 
		poems: d,
		poem
	};	
};

import type { Poem, StrapiPoem, WithId } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { api, handleGetResponse } from '$lib/api';

export const load: PageServerLoad = async ({ params }) => {
	const response = await api("GET", `poems`);
	const res = handleGetResponse(response);

	if (res.ok) {
		const pid = parseInt(params.pid) || 5;
		const poems: StrapiPoem = await res.json();
		const poem: WithId<Poem>= poems.data.filter((_: WithId<Poem>) => _.id === pid)[0];
		
		return { 
			poems,
			poem
		};
	}

	const { message } = await res.json();
	throw error(500, message);
};

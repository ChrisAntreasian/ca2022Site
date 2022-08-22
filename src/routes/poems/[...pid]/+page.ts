import { error } from '@sveltejs/kit';
import type { PageLoad } from "@sveltejs/kit";

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch("/poems.json");
	if (res.ok) {
		const pid = parseInt(params.pid) || 5;
		const poems = await res.json();
		const poem = poems.data.filter((_: WithId<Poem>) => _.id === pid)[0];
		return { 
			poems,
			poem
		};
	}
	const { message } = await res.json();
	throw error(500, message);
};

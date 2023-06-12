import type { Item } from '$lib/Article/types';

import type { PageServerLoad } from './$types';
import * as D from "$data/poems.json"

export const load: PageServerLoad = async ({ params }) => {
	const d = D.data;
	const pid = parseInt(params.pid) || d.data[Math.floor(Math.random() * d.data.length)].id;
	
	const items = d.data.sort((a, b) => a.attributes.position - b.attributes.position).reduce(
		(acc: ReadonlyArray<Item>, _) => [...acc, {
			id: _.id,
			title: _.attributes.title,
			body: _.attributes.body
		}], 
		[]
	);
	
	const item = items.filter((_: Item) => _.id === pid)[0];
	
	return { items, item };
};

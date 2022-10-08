import type { PageServerLoad } from './$types';
import type { StrapiPage, StrapiPageDetails } from "$lib/types";
import { error } from '@sveltejs/kit';

import { mkRequest, handleGetResponse, queryStr } from "$lib/api";

const pQ =  queryStr({ 
  filters: { id: { $in: 1 } },
  populate: [
		"page_details",
		"page_details.art_categories",
		"page_details.poems",
		"page_details.art_piece",
		"page_details.art_piece.image",	
		"page_details.art_piece.image.media",
		"page_details.image.media",
	]
});

const introIds = [5];

export const load: PageServerLoad = async () => {
	const response = await mkRequest("GET", `pages?${pQ}`);
	const res = await handleGetResponse(response);

	if (res.ok) {
		const resp: StrapiPage = await res.json();
		const attrs = resp.data[0].attributes;

		return {
			...attrs.page_details.data.reduce((
				acc: { 
					intro: StrapiPageDetails, 
					links: StrapiPageDetails, 
				}, 
				d: StrapiPageDetails[0]
			) => {
				if (introIds.includes(d.id)) {
					acc.intro.push(d);
				} else {
					acc.links.push(d)
				}
				return acc;
			}, { 
				intro: [], 
				links: [] 
			})
		};
	}

	const { message } = await res.json();
	throw error(500, message);
}
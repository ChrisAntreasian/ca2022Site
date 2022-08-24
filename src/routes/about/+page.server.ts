
import type { PageServerLoad } from './$types';
import type { StrapiPage } from "$lib/types";
import { error } from '@sveltejs/kit';
import { api, handleGetResponse, queryStr } from "$lib/api";

const pQ =  queryStr({ 
  filters: { id: { $in: 2 } },
  populate: [
		"rich_links",
		"rich_links.image",
		"rich_links.image.media",
		"page_details",
		"page_details.image.media",
		"art_pieces",
		"art_pieces.image",
		"art_pieces.image.media",
	]
});

export const load: PageServerLoad = async () => {
	const response = await api("GET", `pages?${pQ}`);
	const res = handleGetResponse(response);

	if (res.ok) {
		const resp: StrapiPage = await res.json();
		const attrs = resp.data[0].attributes;

		return {
			images: attrs.art_pieces.data,
			richLinks: attrs.rich_links.data,
			intro: attrs.page_details.data
		};
	}

	const { message } = await res.json();
	throw error(500, message);
}
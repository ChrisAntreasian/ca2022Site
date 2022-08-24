import '../app.css';

import type { LayoutServerLoad } from './$types';
import type { PageDetails, StrapiApiResp } from "$lib/types";

import { error } from '@sveltejs/kit';
import { api, handleGetResponse, queryStr } from "$lib/api";

const pQ =  queryStr({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});

export const load: LayoutServerLoad = async () => {
	const response = await api("GET", `page-slugs?${pQ}`);
	const res = handleGetResponse(response);
	if (res.ok) {
		
		const details: StrapiApiResp<PageDetails> = await res.json();
		return { 
			logo: details.data[0].attributes.image,
			title: details.data[0].attributes.title
		};
	}

	const { message } = await res.json();
	throw error(500, message);
}

import type { LayoutServerLoad } from './$types';
import type { PageDetails, StrapiApiResp } from "$lib/types";

import { error } from '@sveltejs/kit';
import { mkRequest, handleGetResponse, queryStr } from "$lib/api";

const pQ =  queryStr({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});

const mkMobileString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const load: LayoutServerLoad = async () => {
	const response = await mkRequest("GET", `page-slugs?${pQ}`);	
	const res = await handleGetResponse(response);
	if (res.ok) {		
		const details: StrapiApiResp<PageDetails> = await res.json();
		return { 
			logo: details.data[0].attributes.image,
			title: details.data[0].attributes.title,
			mobileTitle: mkMobileString(details.data[0].attributes.title),
		};
	}

	const { message } = await res.json();
	throw error(500, message);
}

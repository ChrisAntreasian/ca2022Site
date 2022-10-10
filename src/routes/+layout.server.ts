import type { LayoutServerLoad } from './$types';
import type { PageDetails, StrapiApiResp, StrapiBase } from "$lib/types";

import { error, type Cookies } from '@sveltejs/kit';
import { mkRequest, handleGetResponse, queryStr } from "$lib/api";
import * as crypto from "node:crypto"

const pQ =  queryStr({ 
  filters: { id: { $in: 6 } },
  populate: [
		"image",
		"image.media",
		"image.media",
	]
});

const shortenString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const load: LayoutServerLoad = async ({ cookies}) => {
	
	const getData = await mkRequest("GET", `page-slugs?${pQ}`);	
	const pageData = await handleGetResponse(getData);
		
	if (pageData.ok) {		
		const pageDetails: StrapiApiResp<PageDetails> = await pageData.json();
		return { 
			logo: pageDetails.data[0].attributes.image,
			title: pageDetails.data[0].attributes.title,
			mobileTitle: shortenString(pageDetails.data[0].attributes.title),
		};
	}

	const { message } = await pageData.json();
	throw error(500, message);
}

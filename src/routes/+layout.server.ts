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

const daysFromNow = (_: number) => new Date(new Date().getTime()+(_*24*60*60*1000))

const mkDistinctId = (arr: string[]) => {
  const dId = crypto.randomBytes(20).toString('hex');
  if (!arr.includes(dId)) return dId;
	mkDistinctId(arr);
}

export const handleCookie = async (cookies: Cookies) => {
	const cid = cookies.get("distinctId");
  if (cid) return;
  
  const response = await mkRequest("GET", `mixpanel-distinct-ids?${queryStr({ populate: "*" })}`);
  const getRes = await handleGetResponse(response);

  if (!getRes.ok) {
		console.error("fetch failed", getRes.statusText);
		return;
	}
	const resp: StrapiApiResp<StrapiBase & {distinctId: string}> = await getRes.json();
	const idsArr = resp.data.map(_ => _.attributes.distinctId);

	const did = mkDistinctId(idsArr);
	const postReq = await mkRequest(
		"POST", 
		`mixpanel-distinct-ids`, 
		{ data: { distinctId: did } }
	);

	if(postReq.status !== 200) {
		console.error(postReq.statusText);
		return;
	}

	cookies.set("distinctId", did, {
		httpOnly: true,
		expires: daysFromNow(400)
	});
}

const shortenString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const load: LayoutServerLoad = async ({ cookies}) => {
	
	const getData = await mkRequest("GET", `page-slugs?${pQ}`);	
	const pageData = await handleGetResponse(getData);
	
	await handleCookie(cookies);
	
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

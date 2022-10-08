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

const setDistinctId = (arr: string[]) => {
  const dId = crypto.randomBytes(20).toString('hex');
  if (arr.includes(dId)) {
    setDistinctId(arr);
  } else {
    return dId
  }
}
const shortenString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const handleCookie = async (cookies: Cookies) => {
  console.log("THIS cookie h  IS CALLED")
  
	const cid = cookies.get("distinctId");
  if (cid) {
		console.log("cookie already set"); 
		return;
	};
  
  const response = await mkRequest("GET", `mixpanel-distinct-ids?${queryStr({ populate: "*" })}`);
  const res = await handleGetResponse(response);

  if (res.ok) {
    const resp: StrapiApiResp<StrapiBase & {distinctId: string}> = await res.json();
    const idsArr = resp.data.map(_ => _.attributes.distinctId);

		const did = setDistinctId(idsArr);
    cookies.set("distinctId", did, {
      httpOnly: true,
      expires: daysFromNow(400)
    })
    const request = await mkRequest(
      "POST", 
      `mixpanel-distinct-ids`, 
      { data: { distinctId: did } }
    );
    console.log("post result", did);	
  }
}


export const load: LayoutServerLoad = async ({ cookies}) => {
	
	const cid = cookies.get("distinctId");

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

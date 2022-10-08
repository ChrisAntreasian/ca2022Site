import { mkRequest, handleGetResponse, queryStr } from '$lib/api';
import type { StrapiApiResp, StrapiBase } from '$lib/types';
import type { Handle, RequestEvent, ResolveOptions } from '@sveltejs/kit';
import type { MaybePromise } from '@sveltejs/kit/types/private';
import * as crypto from "node:crypto"

const q =  queryStr({ populate: "*" });

const setDistinctId = (arr: string[]) => {
  const dId = crypto.randomBytes(20).toString('hex');
  if (arr.includes(dId)) {
    setDistinctId(arr);
  } else {
    return dId
  }
}
export const handle: Handle = async ({ event, resolve}: { 
  event: RequestEvent, 
  resolve: (event: RequestEvent, opts?: ResolveOptions) => MaybePromise<Response>
}) => {

  const cid = event.cookies.get("distinctId");
  console.log("the initial cookie", cid)
  if (cid) { console.log("we have a cookie"); return resolve(event);}
  
  const response = await mkRequest("GET", `mixpanel-distinct-ids?${q}`);
  const res = await handleGetResponse(response);

  if (res.ok) {
    const resp: StrapiApiResp<StrapiBase & {distinctId: string}> = await res.json();
    const idsArr = resp.data.map(_ => _.attributes.distinctId);
    
    const distinctId = setDistinctId(idsArr);
    event.cookies.set("distinctId", distinctId)
    
    const request = await mkRequest(
      "POST", 
      `mixpanel-distinct-ids`, 
      { data: { distinctId: distinctId } }
    );
    const postRes = await handleGetResponse(request);

    console.log("post result");
  }

  return resolve(event);
}
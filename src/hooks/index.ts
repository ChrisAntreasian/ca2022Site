import { api, handleGetResponse } from '$lib/api';
import type { Handle, RequestEvent, ResolveOptions } from '@sveltejs/kit';
import type { MaybePromise } from '@sveltejs/kit/types/private';
import * as crypto from "node:crypto"
import * as qs from 'qs';

const q = (_: string) => qs.stringify({
	filters: {
		distinctId: {$eq: _ },
	},
});

const ch = crypto.randomBytes(20).toString('hex');

export const handle: Handle = async ({ event, resolve}: { 
  event: RequestEvent, 
  resolve: (event: RequestEvent, opts?: ResolveOptions) => MaybePromise<Response>
}) => {
  const id = event.cookies.get("distinctId");
  if (!id) event.cookies.set("distinctId", ch);

  const did = id ? id : ch;

  const response = await api("GET", `distinct-ids?${q(did)}`);
	const res = await handleGetResponse(response);

  if (res.ok) {
    const resp = await res.json();
    console.log(resp)
    // if in server continue
      // if not on the server persist in strapi
  }
  

  return resolve(event);
}
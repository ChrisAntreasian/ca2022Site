import mixpanel from "mixpanel-browser";
import type { Cookies } from '@sveltejs/kit';
import * as crypto from "node:crypto"
import { daysFromNow } from '$lib/date';
// import { getS3File, uploadS3File } from '$lib/s3';
// import type { S3 } from "aws-sdk";

export const initMixpanel = () => mixpanel.init(import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN, {debug: true});

// const fileName = "distinctIds.json";

const mkDistinctId = (arr: string[]): string => {
  const dId = crypto.randomBytes(20).toString('hex');
  if (!arr.includes(dId)) return dId;
	mkDistinctId(arr);
}
import.meta.env.PROD
export const initDistinctId = async (cookies: Cookies) => {

	const cid = cookies.get("distinctId");
  if (cid) return;

	// const dIdF = await getS3File(s3)(fileName)
	const idsArr: string[] = [];  //await JSON.parse(dIdF.Body.toString('utf-8')) || [];
	const did = mkDistinctId(idsArr);

	// await uploadS3File(s3)(fileName, JSON.stringify([...idsArr, did]));

	cookies.set("distinctId", did, {
		httpOnly: true,
		expires: daysFromNow(400)
	});
}

export const captureDetails = (
	{ id, name }: { id:number, name: string },
	d: Record<string, string> = {}
) => ({
	...d,
	resourceId: id,
	resourceName: name
});

export const captureBehavior = async (eKey: string, props?: any) => {
	if (!import.meta.env.PROD) return;
	const details: Record<string, any> = {...props};
  mixpanel.track(eKey, details);
}

export const captureClickThis = (a: string) => (b: string) => {
	captureBehavior(`click ${a} ${b}`);
}

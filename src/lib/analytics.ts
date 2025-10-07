import type { Cookies } from "@sveltejs/kit";
import { browser } from "$app/environment";
import { daysFromNow } from "$lib/date";
// import { getS3File, uploadS3File } from '$lib/s3';
// import type { S3 } from "aws-sdk";

let mixpanel: typeof import("mixpanel-browser").default | null = null;

export const initMixpanel = async () => {
  if (!browser) return;
  if (!mixpanel) {
    const mixpanelModule = await import("mixpanel-browser");
    mixpanel = mixpanelModule.default;
  }
  mixpanel.init(import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN, { debug: true });
};

// const fileName = "distinctIds.json";

const mkDistinctId = (arr: string[]): string => {
  // Generate a simple random ID for browser environments
  const dId = browser 
    ? Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    : `server-${Date.now()}-${Math.random()}`;
  
  if (!arr.includes(dId)) return dId;
  return mkDistinctId(arr);
};
//import.meta.env.PROD;
export const initDistinctId = async (cookies: Cookies) => {
  const cid = cookies.get("distinctId");
  if (cid) return;

  // const dIdF = await getS3File(s3)(fileName)
  const idsArr: string[] = []; //await JSON.parse(dIdF.Body.toString('utf-8')) || [];
  const did = mkDistinctId(idsArr);

  // await uploadS3File(s3)(fileName, JSON.stringify([...idsArr, did]));

  cookies.set("distinctId", did, {
    path: "/",
    expires: daysFromNow(400),
  });
};

export const captureDetails = (
  { id, name }: { id: number; name: string },
  d: Record<string, string> = {},
) => ({
  ...d,
  resourceId: id,
  resourceName: name,
});

export const captureBehavior = async (eKey: string, props?: Record<string, unknown>) => {
  if (!import.meta.env.PROD) return;
  if (!browser || !mixpanel) return;
  
  const details: Record<string, unknown> = { ...props };
  mixpanel.track(eKey, details);
};

export const captureClickThis = (a: string) => (b: string) => {
  captureBehavior(`click ${a} ${b}`);
};

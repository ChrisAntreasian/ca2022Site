import type { Cookies } from "@sveltejs/kit";
import * as mixpanel from "mixpanel";
import type { RequestHandler } from "@sveltejs/kit";

const mxpInst = mixpanel.init(import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN);

export const POST: RequestHandler = async({ request, cookies, getClientAddress}) => {
  const { eKey, props }: { eKey: string, props: any } = await request.json();
  mxpInst.track(eKey, {
    ...props,
    time: new Date(),
    distinct_id: cookies.get("distinctId"),
    ip: getClientAddress()
  });
  return new Response()
}
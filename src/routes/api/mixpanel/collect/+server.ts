import * as mixpanel from "mixpanel";

const mxpInst = mixpanel.init(import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN);

export async function POST({ request }) {
  const { eKey, props }: { eKey: string, props: any } = await request.json();
  mxpInst.track(eKey, {
    ...props,
    time: new Date(),
    distinct_id: "passed from sesion",
  });
  return new Response()
}
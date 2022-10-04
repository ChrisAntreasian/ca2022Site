import * as mixpanel from "mixpanel";

var mxpInst = mixpanel.init("2ddda4b2dad575ea21a3f79baaba7bfd");

export async function POST({ request }) {
  const { eKey, props }: { eKey: string, props: any } = await request.json();
  mxpInst.track(eKey, {
    ...props,
    time: new Date(),
    distinct_id: "passed from sesion",
  });
  return new Response()
}
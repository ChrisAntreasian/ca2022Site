import mixpanel from "mixpanel-browser";

export const initMixpanel = () => mixpanel.init(import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN, {debug: true}); 

export const captureDetails = (
	{ id, name }: { id:number, name: string }, 
	d: Record<string, string> = {}
) => ({
	...d,
	resourceId: id,
	resourceName: name
});

export const captureBehavior = async (eKey: string, props?: any) => {
	const details: Record<string, any> = {...props};
  mixpanel.track(eKey, details);
}
export const captureClickThis = (a: string) => (b: string) => {
	captureBehavior(`click ${a} ${b}`);
}
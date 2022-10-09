export type  AnalyticsContext = {
  captureBehavior: (eKey: string, props: any) => Promise<void>
}

export const contextAnalyticsKey = "analytics";

export const captureDetails = (
	{ id, name }: { id:number, name: string }, 
	d: Record<string, string> = {}
) => ({
	...d,
	resourceId: id,
	resourceName: name
});

export const captureBehavior = (userAgent: string) => (path: string) => async (eKey: string, props: any) => {
	const details: Record<string, any> = {...props, userAgent, path}
	await fetch('/api/mixpanel/collect', {
		method: 'POST',
		body: JSON.stringify({ eKey,  details } ),
		headers: {
			'content-type': 'application/json'
		}
	});
}
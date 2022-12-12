import type { LayoutServerLoad } from './$types';
import * as D from "$data/layout.json"
import { initDistinctId } from '$lib/analytics';
// import { initS3 } from '$lib/s3';

const shortenString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const load: LayoutServerLoad = async ({ cookies }) => {	
	const d = D.data;
	// const s3 = initS3();
	await initDistinctId(cookies);

	return { 
		logo: d.data[0].attributes.image,
		title: d.data[0].attributes.title,
		mobileTitle: shortenString(d.data[0].attributes.title),
	};
}

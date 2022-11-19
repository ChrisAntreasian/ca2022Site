import type { LayoutServerLoad } from './$types';
import * as D from "$data/layout.json"


const shortenString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const load: LayoutServerLoad = async () => {	
	const pageDetails = D.data;
	return { 
		logo: pageDetails.data[0].attributes.image,
		title: pageDetails.data[0].attributes.title,
		mobileTitle: shortenString(pageDetails.data[0].attributes.title),
	};
}

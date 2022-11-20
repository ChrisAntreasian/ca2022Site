import type { LayoutServerLoad } from './$types';
import * as D from "$data/layout.json"

const shortenString = (_: string) => {
	const a = _.split(" ")
	return `${a[0].charAt(0)}. ${a[1]}`
}

export const load: LayoutServerLoad = async () => {	
	const d = D.data;

	return { 
		logo: d.data[0].attributes.image,
		title: d.data[0].attributes.title,
		mobileTitle: shortenString(d.data[0].attributes.title),
	};
}

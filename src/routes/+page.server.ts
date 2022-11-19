import type { PageServerLoad } from './$types';
import type { StrapiPageDetails } from "$lib/types";
import * as D from "$data/landing.json"

const introIds = [5];

export const load: PageServerLoad = async () => {
		const attrs = D.data.data[0].attributes;
	console.log(attrs)
		return {
			...attrs.page_details.data.reduce((
				acc: { 
					intro: StrapiPageDetails, 
					links: StrapiPageDetails, 
				}, 
				d: StrapiPageDetails[0]
			) => {
				if (introIds.includes(d.id)) {
					acc.intro.push(d);
				} else {
					acc.links.push(d)
				}
				return acc;
			}, { 
				intro: [], 
				links: [] 
			})
		};
}

import type { PageServerLoad } from './$types';
import type { StrapiPage, StrapiPageDetails } from "$lib/types";
import { readData } from '$lib/file';

const introIds = [5];

export const load: PageServerLoad = async () => {
		const d = await readData<StrapiPage>("landing");
		const attrs = d.data[0].attributes;

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

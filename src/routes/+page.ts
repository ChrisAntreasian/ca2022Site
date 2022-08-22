
import type { PageLoad } from '@sveltejs/kit';
import type { StrapiPage, StrapiPageDetails } from "$lib/types";

const introIds = [5, 3, 4];

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/json');
	if (res.ok) {
		const resp: StrapiPage = await res.json();
		const attrs = resp.data[0].attributes;		
		const props: {
			props: {
				intro: StrapiPageDetails,
				links: StrapiPageDetails,
			}
		} = {
			props: { 
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
			},
		};
		throw new Error("@migration task: Migrate this return statement (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
		return props;
	}
}

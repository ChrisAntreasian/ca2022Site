
import type { PageLoad } from '@sveltejs/kit';
import type { StrapiPage, StrapiPageDetails, RichLink, WithId, Art } from "$lib/types";

throw new Error("@migration task: Migrate the load function input (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
export const load: PageLoad = async ({ params, fetch, session, stuff }) => {
	const res = await fetch('/about.json');
	if (res.ok) {
		
		const resp: StrapiPage = await res.json();
		
		const attrs = resp.data[0].attributes;		
		console.log(attrs.art_pieces)
		const props = {
			props: { 
				images: attrs.art_pieces.data,
				richLinks: attrs.rich_links.data,
				intro: attrs.page_details.data
			},
		};
		throw new Error("@migration task: Migrate this return statement (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
		return props;
	}
}

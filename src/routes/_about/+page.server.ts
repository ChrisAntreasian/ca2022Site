import type { PageServerLoad } from './$types';
import * as D from "$data/about.json"

export const load: PageServerLoad = async () => {
	const attrs = D.data.data[0].attributes;

	return {
		images: attrs.art_pieces.data,
		richLinks: attrs.rich_links.data,
		intro: attrs.page_details.data
	};
}

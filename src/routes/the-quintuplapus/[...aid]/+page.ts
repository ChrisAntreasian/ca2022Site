import { error } from '@sveltejs/kit';
import type { PageLoad } from '@sveltejs/kit';
import type { StrapiArtCategory, StrapiArt } from "../../../lib/types";

throw new Error("@migration task: Migrate the load function input (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
export const load: PageLoad = async ({ params, fetch, session, stuff }) => {
	const res = await fetch('/the-quintuplapus.json');
	const aid = parseInt(params.aid) || 2;

	if (res.ok) {
		const resp: StrapiArtCategory = await res.json();
		const omitIds = resp.data[0].attributes.omit.data.map(_ => _.id)
		
		let artPieces = resp.data[0].attributes.art_pieces.data
			.filter(_ =>	!omitIds.includes(_.id))
			.sort((a, b) => a.attributes.order - b.attributes.order)

		const artPiece = artPieces.filter(_ => _.id === aid)[0];
		const categoryTitle = resp.data[0].attributes.title;

		return { 
			categoryTitle,
			artPieces,
			artPiece
		};
	}

	const { message } = await res.json();
	throw error(500, message);
};

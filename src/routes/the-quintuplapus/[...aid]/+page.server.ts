import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { StrapiArtCategory } from "../../../lib/types";
import { fetchData } from '../_modules/api';


export const load: PageServerLoad = async ({ params }) => {
	const res = await fetchData()
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

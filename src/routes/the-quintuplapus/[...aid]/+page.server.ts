import type { PageServerLoad } from './$types';
import * as D from "$data/quintuplapus.json"


export const load: PageServerLoad = async ({ params }) => {

	const aid = parseInt(params.aid) || 2;
	const atttributes = D.data.data[0].attributes;
	const omitIds = atttributes.omit.data.map(_ => _.id)
	let artPieces = atttributes.art_pieces.data
		.filter(_ =>	!omitIds.includes(_.id))
		.sort((a, b) => a.attributes.order - b.attributes.order)

	const artPiece = artPieces.filter(_ => _.id === aid)[0];
	const categoryTitle = atttributes.title;

	return  { 
		categoryTitle,
		artPieces,
		artPiece
	};
};

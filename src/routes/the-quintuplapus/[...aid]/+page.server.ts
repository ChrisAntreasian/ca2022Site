import type { PageServerLoad } from './$types';
// import { readData, dataKey } from '$lib/file';
// import type { StrapiArtCategory } from '$lib/types';
import * as D from "$data/the-quintuplapus.json"

export const load: PageServerLoad = async ({ params, routeId }) => {
	
	const aid = parseInt(params.aid) || 2;
	const d = D.data; // await readData<StrapiArtCategory>(dataKey(routeId));
	const atttributes = d.data[0].attributes;

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

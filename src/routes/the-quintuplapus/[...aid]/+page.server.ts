import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { StrapiArtCategory } from "../../../lib/types";
import qs from "qs";
import { api, handleGetResponse } from '$lib/api';

const q = qs.stringify({
	filters: {
		id: { $in: 3 },
	},
  populate: [
		"omit",
		"featured",
    "art_pieces",
    "art_pieces.image",
		"art_pieces.image.media",
  ],
});

export const load: PageServerLoad = async ({ params }) => {
	const response = await api("GET", `art-categories?${q}`);
	const res = handleGetResponse(response);

	// const res = await fetch('/the-quintuplapus.json');
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

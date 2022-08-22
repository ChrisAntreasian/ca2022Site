import Header from './_modules/Header.svelte';
import Footer from './_modules/Footer.svelte';
import '../app.css';

import type { LayoutLoad } from '@sveltejs/kit';
import type { PageDetails, StrapiApiResp, StrapiImageData } from "$lib/types";
import { setContext } from "svelte";
import { contextHeightKey } from '$lib/spacing';

export const load: LayoutLoad = async ({ fetch }) => {
	const res = await fetch('/layout.json');
	if (res.ok) {
		
		const dets: StrapiApiResp<PageDetails> = await res.json();
		const logo = dets.data[0].attributes.image;

		return { 
			logo: dets.data[0].attributes.image,
			title: dets.data[0].attributes.title
		};
	}
}

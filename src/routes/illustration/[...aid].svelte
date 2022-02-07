<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	export const load: Load = async ({ page, fetch, session, stuff }) => {
		const res = await fetch('/illustration.json');
		const aid = parseInt(page.params.aid) || 1;
		if (res.ok) {
			const artPieces = await res.json();
			const artPiece = artPieces.data.filter(_ => _.id === aid)[0];
			return {
				props: { 
					artPieces,
					artPiece
				},
			};
		}
		const { message } = await res.json();
		return {
			error: new Error(message)
		};
	};
</script>

<script lang="ts">
	import type { StrapiArt } from "./../../lib/types";
	import { beforeUpdate } from "svelte";
	import { clientNavigate } from "./../../lib/history"
	import Article from "./_Article.svelte";
	import Nav from "./_Nav.svelte";

	export let artPieces: StrapiArt;
	export let artPiece: StrapiArt["data"][number];
	
	beforeUpdate(() =>{
		const rem = 16;
		const eh = 2 * rem;
		const fh = 5 * rem;
		const hh = 3 * rem;

		const widgetH = window.outerHeight - fh - hh - eh;
		document.documentElement.style.setProperty('--galleryHeight', `${widgetH / rem}rem`);
	})
	const clientNavigateS = clientNavigate(false);
	const setArtPiece = (id: number) => (e: Event) => {
		e.preventDefault();
		artPiece = artPieces.data.filter(_ => _.id === id)[0];
		clientNavigateS(`/illustration/${artPiece.id}`, artPiece.attributes.title);
	}

	//before load 
		// get window height
		// X = subract footer height and header height
		// X = set top margin to header height
		// Nav = width 100%
		// Nav = absolute position to the bottom the thumbnail navigation
		// IMG = height = X - Nav
		// Img = max sidth :wrapper width
</script>

<svelte:head>
	<title>Illustration</title>
</svelte:head>

<section>
	<Article art={artPiece.attributes} />
	<Nav artPiece={artPiece} artPieces={artPieces} setArtPiece={setArtPiece} />
</section>

<style>
	section {
		position: relative;
		height: var(--galleryHeight);
	}
</style>

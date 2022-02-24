<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	import type { StrapiArtCategory, StrapiArt } from "./../../lib/types";
	
	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/illustration.json');
		const aid = parseInt(params.aid) || 2;

		if (res.ok) {
			const resp: StrapiArtCategory = await res.json();
			const omitIds = resp.data[0].attributes.omit.data.map(_ => _.id)
			const artPieces = resp.data[0].attributes.art_pieces.data
				.filter(_ =>	!omitIds.includes(_.id))
				.sort((a, b) => a.attributes.order - b.attributes.order);
			const artPiece = artPieces.filter(_ => _.id === aid)[0];
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
	import { beforeUpdate } from "svelte";
	import { clientNavigate } from "./../../lib/history";
	import Article from "./_Article.svelte"
	import Nav from "./_Nav.svelte"
	import { rem } from '$lib/spacing';
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

	export let artPieces: StrapiArt["data"];
	export let artPiece: StrapiArt["data"][number];

	beforeUpdate(() => {
		const extraHeight = 2 * rem;
		const footerHeight = 5 * rem;
		const headerHeight = 3 * rem;
		const navHeight = 6 * rem;

		const widgetH = window.outerHeight - footerHeight - headerHeight - extraHeight;
		document.documentElement.style.setProperty('--gallery-height', `${widgetH / rem}rem`);
		document.documentElement.style.setProperty('--gallery-section-height', `${Math.ceil((widgetH - navHeight - rem) / rem)}rem`);
	});

	const transitionDetails = {
		easing: cubicOut,
    duration: 700,
  }

  const imageWidth = tweened(50, transitionDetails);
	const detailsWidth = tweened(50, transitionDetails);
	
	let showMore = true;
	
	const clientNavigateS = clientNavigate(false);
	
	const setArtPiece = (id: number) => (e: Event) => {
		e.preventDefault();
		imageWidth.set(50);
		detailsWidth.set(50);
		artPiece = artPieces.filter(_ => _.id === id)[0];
		showMore = true;
		clientNavigateS(`/illustration/${artPiece.id}`, artPiece.attributes.title);
	}

	const readMoreClick = (_: boolean) => () => {
    if (showMore) {
      imageWidth.set(34);
      detailsWidth.set(66)
    } else {
      imageWidth.set(50);
      detailsWidth.set(50)
    }
    showMore = _
  }
</script>

<svelte:head>
	<title>Illustration</title>
</svelte:head>

<section>
	<Article 
		art={artPiece} 
		imageWidth={$imageWidth} 
		detailsWidth={$detailsWidth} 
		showMore={showMore} 
		readMoreClick={readMoreClick}
	/>

	<Nav artPiece={artPiece} artPieces={artPieces} setArtPiece={setArtPiece} />

</section>

<style>
	section {
		position: relative;
		height: var(--gallery-height);
		justify-content: center;
		flex-shrink: 1;
	}
</style>

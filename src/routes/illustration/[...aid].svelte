<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	import type { StrapiArtCategory, StrapiArt } from "./../../lib/types";
	
	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/illustration.json');
		const aid = parseInt(params.aid) || 2;

		if (res.ok) {
			const resp: StrapiArtCategory = await res.json();
			const omitIds = resp.data[0].attributes.omit.data.map(_ => _.id)
			
			let artPieces = resp.data[0].attributes.art_pieces.data
				.filter(_ =>	!omitIds.includes(_.id))
				.sort((a, b) => a.attributes.order - b.attributes.order)
				
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
	import { afterUpdate, getContext } from "svelte";
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from "svelte/transition";

	import { afterNavigate } from '$app/navigation';

	import { clientNavigate } from "$lib/history";
	import { contextHeightKey, rem } from '$lib/spacing';

	import Article from "./_Article.svelte"
	import Nav from "./_Nav.svelte"

	export let artPieces: StrapiArt["data"];
	export let artPiece: StrapiArt["data"][number];

	const { getHeaderHeight, getFooterHeight } = getContext(contextHeightKey);
	
	const extraHeight = 3.5 * rem;
	const navHeight = 6 * rem;

	let gallarySectionHeight: number;

	const initGalary = () => {
		const footerHeight = getFooterHeight();
		const headerHeight = getHeaderHeight();
		const widgetH = window.outerHeight - footerHeight - headerHeight - extraHeight;
		
		gallarySectionHeight = Math.ceil((widgetH - navHeight - rem) / rem);
		document.documentElement.style.setProperty('--gallery-height', `${widgetH / rem}rem`);
		document.documentElement.style.setProperty('--gallery-section-height', `${gallarySectionHeight}rem`);
	}

	let windowWidth: number;

	afterUpdate(initGalary);
	afterNavigate(initGalary);
	$: if(windowWidth) initGalary();

	const transitionDetails = {
		easing: cubicOut,
    duration: 700,
  }

  const imageWidth = tweened(50, transitionDetails);
	const detailsWidth = tweened(50, transitionDetails);
	
	let showMore = true;
	const clientNavigateS = clientNavigate(false);

	const resetGallary = () => {
		imageWidth.set(50);
		detailsWidth.set(50);
		showMore = true;
	}	
	const setArtPiece = (id:number) => {
		artPiece = artPieces.filter(_ => _.id === id)[0];
		clientNavigateS(`/illustration/${artPiece.id}`, artPiece.attributes.title);
	}

	let paginationDetails = {
		length: artPieces.length,
		position: 0
	}

	const navArtPieceClick = (id: number) => (e: Event) => {
		e.preventDefault();
		if (id == artPiece.id) return;

		resetGallary()
		setArtPiece(id);
		paginationDetails.position = artPieces.findIndex(_ => _.id == artPiece.id);
	}

	const paginateArtPiece = (n: number) => {
		const index = artPieces.findIndex(_ => _.id == artPiece.id);
		resetGallary();
		setArtPiece(artPieces[index + n].id);
		paginationDetails.position = index + n;
	}

	const readMoreClick = (_: boolean) => {
		const d = showMore ? {img: 34, details: 66} : {img: 50, details: 50};
		imageWidth.set(d.img);
		detailsWidth.set(d.details)	
    showMore = _
  }

</script>

<svelte:head>
	<title>Illustration</title>
</svelte:head>

<svelte:window bind:innerWidth={windowWidth} />

<section transition:fade={{duration: 300}}>
	<Article 
		art={artPiece} 
		imageWidth={$imageWidth} 
		detailsWidth={$detailsWidth} 
		showMore={showMore} 
		readMoreClick={readMoreClick}
		gallarySectionHeight={gallarySectionHeight}
		paginateArtPiece={paginateArtPiece}
		paginationDetails={paginationDetails}
		windowWidth={windowWidth}
	/>

	<Nav 
		artPiece={artPiece} 
		artPieces={artPieces} 
		navArtPieceClick={navArtPieceClick} 
	/>

</section>

<style>
	section {
		position: relative;
		height: var(--gallery-height);
		justify-content: center;
		flex-shrink: 1;
	}
</style>


<script lang="ts">

	import { afterUpdate, getContext } from "svelte";
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from "svelte/transition";

	import { afterNavigate } from '$app/navigation';

	import { clientNavigate } from "$lib/history";
	import { contextHeightKey, rem, mqBreakPoint, type LayoutElemH } from "$lib/spacing";

	import Article from "../_modules/Article.svelte"
	import Nav from "../_modules/Nav.svelte"
	import type { PageServerData } from "./$types";
	import { captureDetails, captureBehavior } from "$lib/analytics";
	
	export let data: PageServerData;  

	const { getHeaderHeight, getFooterHeight }: LayoutElemH = getContext(contextHeightKey);

	const extraHeight = 3.5 * rem;
	const navHeight = 6 * rem;

	let gallarySectionHeight: number;

	const initGalary = () => {
		if (!windowWidth || windowWidth <=  768) return;

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
		data.artPiece = data.artPieces.filter(_ => _.id === id)[0];
		clientNavigateS(`/the-quintuplapus/${data.artPiece.id}`, data.artPiece.attributes.title);
	}

	let paginationDetails = {
		length: data.artPieces.length,
		position: 0
	}
	
	export let expanded = false;
	const setExpanded = (exp: boolean) => {
		expanded = exp;
	}

	const changeSelected = (id: number) => {
		if (windowWidth < mqBreakPoint) {
			window.scrollTo({top: 0});
		} else {
			resetGallary()
		}
		expanded = false;
		setArtPiece(id);
		paginationDetails.position = data.artPieces.findIndex(_ => _.id === data.artPiece.id);
	}
	
	// needs analytics
	const navArtPieceClick = (id: number) => (e: Event) => {
		e.preventDefault();
		if (id == data.artPiece.id) return;
		changeSelected(id);	
		captureBehavior(
			"click thumbnail", 
			captureDetails({ id: id, name: data.artPiece.attributes.title })
		);
	}

	// needs analytics
	const paginateArtPiece = (n: number) => {
		const index = data.artPieces.findIndex(_ => _.id == data.artPiece.id);
		changeSelected(data.artPieces[index + n].id);
		captureBehavior(
			"click paginate", 
			captureDetails(
				{ id: index + n, name: data.artPieces[index + n].attributes.title },
				{ direction: n > 0 ? "next" : "last" }
			)
		);
	}

	const readMoreClick = (_: boolean) => {
		const d = showMore ? {img: 34, details: 66} : {img: 50, details: 50};
		imageWidth.set(d.img);
		detailsWidth.set(d.details);
    showMore = _;
		captureBehavior(
			"click readmore", 
			captureDetails(
				{ id: data.artPiece.id, name: data.artPiece.attributes.title },
			)
		);
  }

</script>

<svelte:head>
	<title>The Quintuplapus</title>
</svelte:head>

<svelte:window bind:innerWidth={windowWidth} />

<section transition:fade={{duration: 300}}>
	<Article 
		art={data.artPiece} 
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
		artPiece={data.artPiece} 
		artPieces={data.artPieces} 
		navArtPieceClick={navArtPieceClick} 
		expanded={expanded}
		setExpanded={setExpanded}
		categoryTitle={data.categoryTitle}
	/>
</section>

<style>
	section {
		position: relative;
		height: var(--gallery-height);
		justify-content: center;
		flex-shrink: 1;
	}
	@media (max-width: 767.98px) {
		section {
			height: auto;
		}
	}
</style>

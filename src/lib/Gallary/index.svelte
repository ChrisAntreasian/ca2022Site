<script lang="ts">

	import { afterUpdate, getContext, onMount } from "svelte";
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from "svelte/transition";

	import { afterNavigate } from '$app/navigation';

	import { clientNavigate } from "$lib/history";
	import { contextHeightKey, rem, mqBreakPoint, type LayoutElemH } from "$lib/spacing";

	import Article from "$lib/Gallary/Article.svelte"
	import Nav from "$lib/Gallary/Nav.svelte"

  import { captureDetails, captureBehavior } from "$lib/analytics";
	import type { Art, WithId } from "$lib/types";
	
  export let artPieces: Array<WithId<Art>>;
  export let artPiece: WithId<Art>;
  export let parentRoute: string;
  export let analyticsKey: string;
  export let categoryTitle: string;
	
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
	let preloadImages = artPieces.map(p => p.attributes.image.data.attributes.url);

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
		clientNavigateS(`${parentRoute}${artPiece.id}`, artPiece.attributes.title);
	}

	let paginationDetails = {
		length: artPieces.length,
		position: 0
	}
	
	let expanded = false;
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
		paginationDetails = {
			length: paginationDetails.length,
			position: artPieces.findIndex(_ => _.id === id)
		}
	}
	
	const navArtPieceClick = (id: number) => (e: Event) => {
		e.preventDefault();
		if (id === artPiece.id) return;
		changeSelected(id);	
		captureBehavior(
			`${analyticsKey} click thumbnail`, 
			captureDetails({ id: id, name: artPiece.attributes.title })
		);
	}

	const paginateArtPiece = (k: string) => (n: number) => {
		const index = artPieces.findIndex(_ => _.id === artPiece.id);
		changeSelected(artPieces[index + n].id);
		captureBehavior(
			`${k} click paginate`, 
			captureDetails(
				{ id: index + n, name: artPieces[index + n].attributes.title },
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
			`${analyticsKey} click readmore`, 
			captureDetails(
				{ id: artPiece.id, name: artPiece.attributes.title },
			)
		);
  }



</script>

<svelte:window bind:innerWidth={windowWidth} />

<svelte:head>
  {#each preloadImages as image}
    <link rel="preload" as="image" href={image} />
  {/each}
</svelte:head>

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
    analyticsKey={analyticsKey}
	/>
	<Nav 
		artPiece={artPiece} 
		artPieces={artPieces} 
		navArtPieceClick={navArtPieceClick} 
		expanded={expanded}
		setExpanded={setExpanded}
		categoryTitle={categoryTitle}
    analyticsKey={analyticsKey}
		parentRoute={parentRoute}
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

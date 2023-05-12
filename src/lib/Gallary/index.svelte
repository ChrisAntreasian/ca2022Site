<script lang="ts">

	import { afterUpdate, getContext, onMount } from "svelte";
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from "svelte/transition";

	import { afterNavigate } from '$app/navigation';

	import { clientNavigate } from "$lib/history";
	import { contextHeightKey, rem, mqBreakPoint, type LayoutElemH, fromRem, toRem } from "$lib/spacing";

	import Article from "$lib/Gallary/Article.svelte"
	import Nav from "$lib/Gallary/Nav.svelte"

  import { captureDetails, captureBehavior } from "$lib/analytics";
	import type { Art, WithId } from "$lib/types";
	
  export let artPieces: Array<WithId<Art>>;
  export let artPiece: WithId<Art>;
  export let parentRoute: string;
  export let analyticsKey: string;
  export let categoryTitle: string;
	
	export let hideMobileTitle: boolean = false;
	export let useUrlTitle: boolean = true;
	const { getFooterHeight }: LayoutElemH = getContext(contextHeightKey);
	
	let windowWidth: number;
	let windowHeight: number;
	let measureH: number;

	let subnavHeight: number;
	let gallarySectionHeight: number;
	let scrollRequestUpdate: boolean = false;
	
	const extraHeight = fromRem(0.5);
	const navHeight = fromRem(6);
	
	const transitionDetails = {
		easing: cubicOut,
    duration: 700,
  }

	const setPaginationDetails = (id: number) => {
		 paginationDetails = {
			length: paginationDetails.length,
			position: artPieces.findIndex(_ => _.id === id)
		}
	}

	const initGalary = () => {

		const footerHeight = getFooterHeight();
		const widgetH = windowHeight + extraHeight - footerHeight;
		
		gallarySectionHeight = Math.ceil((widgetH - navHeight - rem) / rem);

		if (!windowWidth || windowWidth <=  768) return;

		document.documentElement.style.setProperty('--gallery-height', `${toRem(widgetH)}rem`);
		document.documentElement.style.setProperty('--gallery-section-height', `${gallarySectionHeight}rem`);

		setPaginationDetails(artPiece.id)
	}

	afterNavigate(initGalary);

	$: if(windowWidth || artPiece.id) initGalary();

	let preloadImages = artPieces.map(p => p.attributes.image.data.attributes.url);

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
		clientNavigateS(`${parentRoute}${artPiece.id}`, useUrlTitle ? artPiece.attributes.title : null);
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
		setPaginationDetails(id);
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

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<svelte:head>
  {#each preloadImages as image}
    <link rel="preload" as="image" href={image} />
  {/each}
</svelte:head>

<section transition:fade={{duration: 300}}>

	<Article 
		artPiece={artPiece} 
		imageWidth={$imageWidth} 
		detailsWidth={$detailsWidth} 
		showMore={showMore} 
		readMoreClick={readMoreClick}
		gallarySectionHeight={gallarySectionHeight}
		paginateArtPiece={paginateArtPiece}
		paginationDetails={paginationDetails}
		windowWidth={windowWidth}
    analyticsKey={analyticsKey}
		subnavHeight={subnavHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		bind:measureH={measureH}
		hideMobileTitle={hideMobileTitle}
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
		gallarySectionHeight={gallarySectionHeight}
		measureH={measureH}
		bind:subnavHeight={subnavHeight}
		bind:scrollRequestUpdate={scrollRequestUpdate}
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
			flex-direction: column;
		}
	}
</style>

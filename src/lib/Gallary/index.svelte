<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">

	import { afterUpdate, getContext } from "svelte";
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from "svelte/transition";

	import { afterNavigate } from '$app/navigation';

	import { clientNavigate } from "$lib/history";
	import { contextHeightKey, rem, mqBreakPoint, type LayoutElemH, fromRem, toRem } from "$lib/spacing";

	import Article from "$lib/Gallary/Article.svelte"
	import Nav from "$lib/Gallary/Nav.svelte"

  import { captureDetails, captureBehavior } from "$lib/analytics";

	import type { ArtWithId } from "$lib/typing/art"
	import { onMount } from "svelte";
	
  export let artPieces: Array<ArtWithId>;
  export let artPiece: ArtWithId;
  export let parentRoute: string;
  export let analyticsKey: string;
  export let categoryTitle: string;
	
	export let hideMobileTitle: boolean = false;
	export let useUrlTitle: boolean = true;
	
	const { getFooterHeight }: LayoutElemH = getContext(contextHeightKey);

	const clientNavigateS = clientNavigate(false);

	let windowWidth: number;
	let windowHeight: number;
	let measureH: number;

	let subnavHeight: number;
	let gallarySectionHeight: number;
	let scrollRequestUpdate: boolean = false;
	let gallaryHeight = 0;

	const extraHeight = fromRem(2.5);
	const navHeight = fromRem(6);


	let paginationDetails = {
		length: artPieces.length,
		position: 0
	}
	
	const setPaginationDetails = (id: number) => {
		 paginationDetails = {
			length: paginationDetails.length,
			position: artPieces.findIndex(_ => _.id === id)
		}
	}

	const initGallery = () => {
		const footerHeight = getFooterHeight();
		const widgetH = windowHeight + extraHeight - footerHeight;

		if (!windowWidth || windowWidth <=  768) return;
		gallaryHeight = toRem(widgetH);
		gallarySectionHeight = Math.ceil((widgetH - navHeight - rem) / rem);

		setPaginationDetails(artPiece.id)
	}

	afterNavigate(initGallery);
	afterUpdate(initGallery);
	onMount(initGallery);

	$: if(windowWidth || artPiece.id) initGallery();

	let preloadImages = artPieces.map(p => p.attributes.image.data.attributes.url);

	const transitionDetails = {
		easing: cubicOut,
    duration: 700,
  }
	
  const imageWidth = tweened(50, transitionDetails);
	const detailsWidth = tweened(50, transitionDetails);
	
	let showMore = true;

	const resetGallary = () => {
		imageWidth.set(50);
		detailsWidth.set(50);
		showMore = true;
	}	
	const setArtPiece = (id:number) => {
		artPiece = artPieces.filter(_ => _.id === id)[0];
		clientNavigateS(`${parentRoute}${artPiece.id}`, useUrlTitle ? artPiece.attributes.title : null);
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

	const paginateItem = (k: string) => (n: number) => {
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

<section transition:fade|global={{duration: 300}} style="--gallary-height: {gallaryHeight}rem">

	<Article 
		artPiece={artPiece} 
		imageWidth={$imageWidth} 
		detailsWidth={$detailsWidth} 
		showMore={showMore} 
		readMoreClick={readMoreClick}
		gallerySectionHeight={gallarySectionHeight}
		paginateItem={paginateItem}
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
		height: var(--gallary-height);
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

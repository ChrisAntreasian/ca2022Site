<script lang="ts">
  import { getContext } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  import { afterNavigate } from "$app/navigation";

  import { clientNavigate } from "$lib/history";
  import {
    contextHeightKey,
    rem,
    mqBreakPoint,
    type LayoutElemH,
    fromRem,
    toRem,
  } from "$lib/spacing";

  import Article from "$lib/Gallary/Article.svelte";
  import Nav from "$lib/Gallary/Nav.svelte";

  import { captureDetails, captureBehavior } from "$lib/analytics";

  import type { ArtWithId } from "$lib/typing/art";
  import { onMount } from "svelte";
  type GallaryProps = {
    artPieces: Array<ArtWithId>;
    artPiece: ArtWithId;
    parentRoute: string;
    analyticsKey: string;
    categoryTitle: string;
    hideMobileTitle?: boolean;
    useUrlTitle?: boolean;
  };

  let {
    artPieces,
    artPiece,
    parentRoute,
    analyticsKey,
    categoryTitle,
    hideMobileTitle,
    useUrlTitle,
  }: GallaryProps = $props();

  const { getFooterHeight }: LayoutElemH = getContext(contextHeightKey);

  const clientNavigateS = clientNavigate(false);

  let windowWidth: number = $state();
  let windowHeight: number = $state();
  let measureH: number = $state();

  let subnavHeight: number = $state();
  let gallarySectionHeight: number = $state();
  let scrollRequestUpdate: boolean = $state(false);
  let gallaryHeight = $state();

  let shoudPageinateSlider: (apId: number) => void = $state();

  const extraHeight = fromRem(2.5);
  const navHeight = fromRem(6);

  let paginationDetails = $state({
    length: artPieces.length,
    position: 0,
  });
  const setPaginationDetails = (id: number) => {
    paginationDetails = {
      length: paginationDetails.length,
      position: artPieces.findIndex((p) => p.id === id),
    };
  };

  const initGallery = () => {
    if (!artPiece || !windowWidth || windowWidth <= mqBreakPoint) return;

    const footerHeight = getFooterHeight();
    const widgetH = windowHeight + extraHeight - footerHeight;

    gallaryHeight = toRem(widgetH);
    gallarySectionHeight = Math.ceil((widgetH - navHeight - rem) / rem);

    setPaginationDetails(artPiece.id);
  };

  onMount(initGallery);
  afterNavigate(initGallery);

  let preloadImages = artPieces.map(
    (p) => p.attributes.image.data.attributes.url
  );

  const transitionDetails = {
    easing: cubicOut,
    duration: 700,
  };

  const imageWidth = tweened(50, transitionDetails);
  const detailsWidth = tweened(50, transitionDetails);

  let showMore = $state(true);

  const resetGallary = () => {
    imageWidth.set(50);
    detailsWidth.set(50);
    showMore = true;
  };
  const setArtPiece = (id: number) => {
    artPiece = artPieces.filter((p) => p.id === id)[0];
    clientNavigateS(
      `${parentRoute}${artPiece.id}`,
      useUrlTitle ? artPiece.attributes.title : null
    );
  };

  let expanded = $state(false);
  const setExpanded = (exp: boolean) => {
    expanded = exp;
  };

  const changeSelected = (id: number) => {
    if (windowWidth < mqBreakPoint) {
      window.scrollTo({ top: 0 });
    } else {
      resetGallary();
    }
    expanded = false;
    setArtPiece(id);
    setPaginationDetails(id);
  };

  const navArtPieceClick = (id: number) => (e: Event) => {
    e.preventDefault();
    if (id === artPiece.id) return;
    changeSelected(id);
    captureBehavior(
      `${analyticsKey} click thumbnail`,
      captureDetails({ id: id, name: artPiece.attributes.title })
    );
  };

  const paginateItem = (k: string) => (n: number) => {
    const index = artPieces.findIndex((_) => _.id === artPiece.id);
    changeSelected(artPieces[index + n].id);
    shoudPageinateSlider(artPieces[index + n].id);
    captureBehavior(
      `${k} click paginate`,
      captureDetails(
        { id: index + n, name: artPieces[index + n].attributes.title },
        { direction: n > 0 ? "next" : "last" }
      )
    );
  };

  const readMoreClick = (s: boolean) => {
    const d = showMore ? { img: 34, details: 66 } : { img: 50, details: 50 };
    imageWidth.set(d.img);
    detailsWidth.set(d.details);
    showMore = s;
    captureBehavior(
      `${analyticsKey} click readmore`,
      captureDetails({ id: artPiece.id, name: artPiece.attributes.title })
    );
  };
</script>

<svelte:window
  bind:innerWidth={windowWidth}
  bind:innerHeight={windowHeight}
  onresize={initGallery}
/>

<svelte:head>
  {#each preloadImages as image}
    <link rel="preload" as="image" href={image} />
  {/each}
</svelte:head>

<section
  transition:fade|global={{ duration: 300 }}
  style="--gallary-height: {gallaryHeight}rem"
>
  <Article
    {artPiece}
    imageWidth={$imageWidth}
    detailsWidth={$detailsWidth}
    {showMore}
    {readMoreClick}
    gallerySectionHeight={gallarySectionHeight}
    {paginateItem}
    {paginationDetails}
    {windowWidth}
    {analyticsKey}
    {subnavHeight}
    {scrollRequestUpdate}
    bind:measureH
    {hideMobileTitle}
  />
  <Nav
    {artPiece}
    {artPieces}
    {navArtPieceClick}
    {expanded}
    {setExpanded}
    {categoryTitle}
    {analyticsKey}
    {parentRoute}
    {gallarySectionHeight}
    {measureH}
    bind:subnavHeight
    bind:scrollRequestUpdate
    bind:shoudPageinateSlider
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

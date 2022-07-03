<script lang="ts">
  import { afterUpdate } from "svelte";
	import { afterNavigate } from '$app/navigation';

  import type { StrapiArt} from "$lib/types";
	import { cleanUrlSlug } from "$lib/history";
  import { apiBaseUrl } from "$lib/api";
  import { wrapperWidth, rem, toRem, fromRem } from "$lib/spacing";

  import Arrow from "$lib/arrow/Arrow.svelte"

  export let artPieces: StrapiArt["data"]
	export let artPiece: StrapiArt["data"][number];
	export let navArtPieceClick: (_: number) => (e: Event) => void;
	
  export let expanded: boolean;
  export let setExpanded: (_:boolean) => void;

  export let categoryTitle: string;

  const thubmnailWidth = fromRem(6);
  
  let subnavWidth: number;
  let itemsPerPage = 0;
  const initNav = () => {
    itemsPerPage = Math.floor(
      (subnavWidth ? subnavWidth : wrapperWidth) / (thubmnailWidth + rem)
    );
  }

  afterUpdate(initNav);
	afterNavigate(initNav);

	$: if(subnavWidth) initNav();

  let activeItemIndex = 0;
  const paginate = (n: number) => { 
    const aii = activeItemIndex + (n * (itemsPerPage - 1))
    activeItemIndex = aii < 0 ? 0 : aii > artPieces.length ? artPieces.length : aii;
  };

  let windowHeight;
  $: navHeight = windowHeight * 0.72;

  let windowWidth;

</script>

<svelte:window bind:innerHeight={windowHeight} bind:outerWidth={windowWidth} />

<nav class="subnav" bind:clientWidth={subnavWidth} style={`--window-width: ${windowWidth / rem}rem`}>
  <div class="subnav-wrap" >
    <div class="subnav-handle" on:click={() => setExpanded(!expanded)}>
      <h3>{expanded ? categoryTitle: artPiece.attributes.title}</h3>
      <div class="subnav-icon">
        <Arrow direction={expanded ? "bottom": "top"} color="white" size="medium" />
      </div>
    </div>
    {#if activeItemIndex > 0}
      <div class="last" on:click={() => paginate(-1)}>
        <Arrow direction="left" color="white" size="large" />
      </div>
    {/if}
    <div class="subnav-content">
      <ul 
        class:expanded={expanded} 
        style={`
          --nav-height: ${toRem(navHeight)}rem;
          --nav-offset: ${toRem(activeItemIndex * thubmnailWidth) * -1}rem;
        `}
      >
        {#each artPieces as _, i}
          <li class:active={_.id === artPiece.id}>
            <a
              on:click={navArtPieceClick(_.id)}
              href="{`/illustration/${_.id}/${cleanUrlSlug(_.attributes.title)}`}"
              class:active="{_.id === artPiece.id}" 
            >
              <img 
                src={`${apiBaseUrl}${_.attributes.image.data.attributes.formats.thumbnail.url}`} 
                alt={_.attributes.description} 
              />
            </a>
          </li>
        {/each}
      </ul>  
    </div>
    {#if activeItemIndex + itemsPerPage < artPieces.length}
      <div class="next" on:click={() => paginate(1)}>
        <Arrow direction="right" color="white" size="large" />
      </div>
    {/if}
  </div>
</nav>

<style>
  nav {
    width: var(--window-width);
    height: 6rem;
    position: absolute;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    background-image: linear-gradient(var(--p-dk), var(--p-md));


	}
  .subnav-wrap {
    width: calc(var(--wrapper-width) - 9rem);
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
    padding: 0 4.5rem;
  }
  .subnav-wrap:before,
  .subnav-wrap:after {
    content: "";
    width: 4.5rem;
    height: 100%;
    position: absolute;
    z-index: 10;
    background: var(--p-dk);
    background-image: linear-gradient(var(--p-dk), var(--p-md));
    
  }
  .subnav-wrap:before {
    left: 0;
    mask-image: linear-gradient(to left, transparent 25%, black 50%);

  }
  .subnav-wrap:after {
    right: 0;
    mask-image: linear-gradient(to right, transparent 25%, black 50%);

  }
  .subnav-content {
    width: 100%;
    height: 100%;
    position: relative;
  }
  .last, .next {
    position: absolute;
    z-index: 20;
    transition: transform 0.2s ease-in-out;
  }
  .last:hover, .next:hover {
    transform: scale(1.15);
  }
  .last {
    left: 0;
  }
  .next {
    right: 0;
  }
  ul {
    height: 100%;
		display: flex;
    align-items: center;
    position: absolute;
		padding: 0;
    left: 0;
    margin-left: var(--nav-offset);
    transition: 
      height 0.33s ease-in-out,
      margin-left 0.4s ease-in-out, 
      opacity 0.4s ease-in-out 0.2s
    ;
	}
	li img {
    height: auto;
    width: 100%;
    object-fit: cover;
    border-radius: 0.333rem;
  }
  li {
    margin-right: 1rem;
    border-radius: 0.333rem;
    transition: transform 0.2s ease-in-out;
  }
  li:last-of-type {
    margin-left: 0;
  }
  li:hover,
  li.active {
    transform: scale(1.15);
  }
  li.active {
    outline: 0.25rem solid var(--y-md);
  }
  
  li a {
    width: 5rem;
    height: 4rem;
    display: flex;
  }
  @media (max-width: 767.98px) { 
    nav {
      height: auto;
      width: auto;
      position: fixed;
      padding: 0;
    }
    .subnav-wrap {
      width: 100%;
      flex-direction: column;
      padding: 0;
    }

    .subnav-wrap::before,
    .subnav-wrap::after {
      display: none;
    }
    ul {
      height: 0;
      position: relative;
      flex-wrap: wrap;
      margin-left: 0 !important;
      justify-content: space-around;
      opacity: 1!important;
    }
    .subnav ul.expanded {
      height: var(--nav-height);
    }

    li {
      margin: 1.5rem 0.5rem;
    }
  
    li a {
      width: 8rem;
      height: 8rem;
    }
    .next, .last {
      display: none;
    }
  }

</style>
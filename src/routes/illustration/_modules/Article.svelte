<script lang="ts">

  import type { StrapiArt } from "$lib/types";
  
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { fade } from "svelte/transition";
  import SvelteMarkdown from 'svelte-markdown'

  import { apiBaseUrl } from "$api/api.config";
  import { rem } from "$lib/spacing";
  import Arrow from '$lib/arrow/Arrow.svelte';
  import FullScreen from './fullscreen/Fullscreen.svelte';

  export let art: StrapiArt["data"][number];
  export let imageWidth: number;
  export let detailsWidth: number;
  export let showMore: boolean;
  export let gallarySectionHeight: number;
  export let windowWidth: number;
  export let paginationDetails: {
    length: number,
    position: number
  }

  export let paginateArtPiece: (n: number) => void;
  export let readMoreClick: (_: boolean) => void;

  import { contextHeightKey, mqBreakPoint } from "$lib/spacing";
	import { getContext } from "svelte";

  let transitioning = false;

  let isBeforeNavigate = false;

  let headlineHeight: number;
  let metaHeight: number;

  let needsOverflow = false;
  let detailsDiv: HTMLDivElement;
  const setOverflow = () => {
    if (isBeforeNavigate || !detailsDiv || windowWidth < mqBreakPoint) return;
    needsOverflow = detailsDiv.scrollHeight > detailsDiv.clientHeight;
  };
    
  beforeNavigate(() => { isBeforeNavigate = true });
  afterNavigate(setOverflow);

  $: if(windowWidth) setOverflow();

  let windowHeight;
  const { getHeaderHeight, getFooterHeight } = getContext(contextHeightKey);

</script>

<svelte:window bind:innerHeight={windowHeight} />
  <article style={`
    --min-height: ${(windowHeight - getHeaderHeight() - getFooterHeight() -2.66 * rem) / rem}rem;
    --min-height-mobile: ${(windowHeight - getHeaderHeight()) / rem}rem
  `}>
    <div class="wrap">
      {#key art.id}
        <figure 
          class:transition={transitioning}
          in:fade={{duration: 500}}
          out:fade={{duration: 300}}
          on:introend="{() => {
            setOverflow()
            transitioning = false;
          }}"
          on:outrostart="{() => {
            needsOverflow = false;
            transitioning = true;
          }}"
        >
          <div class="image" style={`width: ${imageWidth}%`}>
            <img 
              src={`${apiBaseUrl}${art.attributes.image.data.attributes.url}`} 
              alt={art.attributes.description} 
            />
            <FullScreen img={art} />
          </div>
          <figcaption style={`--caption-width: ${detailsWidth}%`}>
            <div>
              <h3 bind:clientHeight={headlineHeight}>{art.attributes.title}</h3>
              <div class={`md-wrap ${!showMore ? "overflow" : needsOverflow ? "needs-overflow" : ""}`}>
                <div 
                  bind:this={detailsDiv}
                  class="md-content"
                  style={`height: ${`${(gallarySectionHeight * rem - metaHeight - headlineHeight -  4 * rem) / rem}rem;`}`}
                >
                  <span class="md-content-desktop">
                    <SvelteMarkdown source={art.attributes.description} />
                  </span>
                  <span class="md-content-mobile">
                    <SvelteMarkdown source={`${art.attributes.title} ${art.attributes.description}`} />
                  </span>
                  {#if needsOverflow}
                    <div class="readmore" 
                      transition:fade={{duration: 300}} 
                      on:click={() => {
                        readMoreClick(!showMore);
                        detailsDiv.scrollTo({top: 0})
                      }}
                    >
                      {!showMore ? "read less" : "read more"}
                    </div>
                  {/if}
                </div>
                {#if showMore}
                  <div 
                    class="fade"
                    transition:fade={{duration: 300}}
                  />
                {/if}
              </div>
            </div>
            <div class="details" bind:clientHeight={metaHeight}>
              <div>
                <div class="meta">
                  <span>date: </span>
                  {new Date(art.attributes.createdDate).getFullYear()}
                </div>
                <div class="meta">
                  <span>medium:</span>
                  {art.attributes.medium}
                </div>
              </div>
              <div>
                <div class="pagination">
                  {#if paginationDetails.position !== 0 }
                    <span class="pagination-link last" on:click={() => paginateArtPiece(-1)}>
                      <Arrow color="blue" size="small" direction="left" />
                      last
                    </span>
                  {/if}
                  {#if paginationDetails.position !== 0 && paginationDetails.position + 1 < paginationDetails.length}
                    <span>|</span>
                  {/if}
                  {#if paginationDetails.position + 1 < paginationDetails.length}
                    <span class="pagination-link next" on:click={() => paginateArtPiece(1)}>
                      next
                      <Arrow color="blue" size="small" direction="right" />
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </figcaption>
        </figure>
      {/key}
    </div>
  </article>


<style>
  article {
    height: var(--gallery-section-height);
    width: 100%;
    min-height: var(--min-height);
    max-width: var(--wrapper-width);
    display: flex;
    justify-content: center;
    position: absolute;
    padding-top: calc(var(--space-md) + 1rem);
  }
  .wrap {
    position: relative;
    height: 100%;
    width: 100%;
  }
  figure {
    height: 100%;
    display: flex;
  }
  .image {
    display: flex;
    justify-content: flex-end;
    position: relative;
    width: 50%;
  }
  img {
    width: 100%;
    object-fit: cover;
  }
  figcaption {
    overflow: hidden;
    padding-left: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: var( --caption-width);
  }
  .pagination {
    color: var(--off-bk);
    text-align: right;
  }
  .md-wrap {
    position: relative
  }
  .md-content {
    overflow: hidden;
  }
  .md-content-mobile {
    display: none;
  } 
  .needs-overflow .fade {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 100%;
    background: linear-gradient(180deg, transparent 30%, var(--w-xl) 70%);
    height: 3rem;
    z-index: 5;
    pointer-events: none;
    height: 3rem;
  }
  .overflow .md-content{
    overflow: scroll;
  }
  .meta,
  .meta span {
    margin-bottom: var(--space-sm);
    font-family: "josefin-italic";
    font-size: 1rem;
  }
  .details {
    font-size: 0.9rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .pagination,
  .pagination-link {
    display: flex;
    align-items: center;
  }
  .pagination-link,
  .readmore {
    cursor: pointer;
    color: var(--bg-lt);  
  }
  span:hover,
  .readmore:hover {
    color: var(--b-lt);
    border-color: var(--b-lt);
  }
  .readmore {
    position: absolute;
    bottom: 0;
    right: 0;
    z-index: 10;
    background: var(--w-lt);
    box-shadow: 0 0 1rem 0.5rem var(--w-lt);
  }
  .meta span {
    font-family: "josefin-bold";
  }
  .last {
    padding-right: 0.25rem;
  }
  .next {
    padding-left: 0.25rem;
  }
  @media (max-width: 767.98px) {
    article {
      height: auto;
      position: relative;
      min-height: var(--min-height-mobile);
    }
    .image,
    figcaption {
      width: 100% !important;
      max-width: 30rem;
    }
    figcaption,
    figure {
      flex-direction: column;
    }
    figure {
      align-items: center;
    }
    figcaption {
      align-items: flex-start;
      padding-left: 0;
    }
    .md-content {
      height: auto;
    }
    .details {
      width: 100%;
    }
    h3 {
      display: none;
    }
    .md-content-mobile {
      display: block;
    }
    .md-content-desktop {
      display: none;
    }
  }

</style>
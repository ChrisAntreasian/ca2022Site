<script lang="ts">

  import type { StrapiArt } from "$lib/types";
  
  import { afterNavigate } from '$app/navigation';
  import { fade } from "svelte/transition";
  import SvelteMarkdown from 'svelte-markdown'

  import { apiBaseUrl } from "$lib/api";	
  import { rem } from "$lib/spacing";
  import Arrow from '$lib/Arrow.svelte';
  import FullScreen from './_fullscreen/Fullscreen.svelte';

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
  
  let headlineHeight: number;
  let metaHeight: number;

  let needsOverflow = false;
  let detailsDiv: HTMLDivElement;
  const setOverflow = () => {
    needsOverflow = detailsDiv.scrollHeight > detailsDiv.clientHeight;
  };
    
  afterNavigate(setOverflow);
	$: if(windowWidth) setOverflow();

</script>

{#key art.id}
  <article>
    <figure
      in:fade={{duration: 300, delay: 50}}
      out:fade={{duration: 300}}
      on:introend="{setOverflow}"
      on:outrostart="{() => {
        needsOverflow = false
      }}"
    >
      <div class="image-wrap" style={`width: ${imageWidth}%`}>
        <img 
          src={`${apiBaseUrl}${art.attributes.image.data.attributes.url}`} 
          alt={art.attributes.description} 
        />
        <FullScreen img={art} />
      </div>
      <figcaption style={`width: ${detailsWidth}%`}>
        <div>
          <h3 bind:clientHeight={headlineHeight}>{art.attributes.title}</h3>
          <div class={`md-wrap ${!showMore ? "overflow" : needsOverflow ? "needs-overflow" : ""}`}>
            <div 
              bind:this={detailsDiv}
              class={`md-content`}
              style={`height: ${`${(gallarySectionHeight * rem - (4 * rem) - metaHeight - headlineHeight - (rem * 2)) / rem}rem;`}`}
            >
              <SvelteMarkdown source={art.attributes.description} />
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
        <div class="details-foot" bind:clientHeight={metaHeight}>
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
                <span class="pagination-link" on:click={() => paginateArtPiece(-1)}>
                  <Arrow color="blue" size="small" direction="left" />
                  last
                </span>
              {/if}
              {#if paginationDetails.position !== 0 && paginationDetails.position + 1 < paginationDetails.length}
                <span>|</span>
              {/if}
              {#if paginationDetails.position + 1 < paginationDetails.length}
                <span class="pagination-link" on:click={() => paginateArtPiece(1)}>
                  next
                  <Arrow color="blue" size="small" direction="right" />
                </span>
              {/if}
            </div>
          </div>
        </div>
      </figcaption>
    </figure>
  </article>
{/key}

<style>
  article {
    height: var(--gallery-section-height);
    width: 100%;
    max-width: var(--wrapper-width);
    display: flex;
    justify-content: center;
    position: absolute;
    padding-top: calc(var(--space-md) + 1rem);
  }
  figure {
    display: flex;
  }
  .image-wrap {
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
    width: 50%;
  }
  .pagination {
    color: var(--off-bk);
    text-align: right;
    margin-right: 0.25rem;
  }
  .md-wrap {
    position: relative
  }
  .md-content {
    overflow: hidden;
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
  .meta {
    margin-bottom: var(--space-sm);
    font-family: "josefin-itallic";
  }
  .details-foot {
    font-size: 0.9rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
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
  span:first-of-type {
    padding-right: 0.25rem;
  }
  span:last-of-type {
    padding-left: 0.25rem;
  }

</style>
<script lang="ts">

  import type { StrapiArt } from "$lib/types";
  
  import { afterNavigate } from '$app/navigation';
  import SvelteMarkdown from 'svelte-markdown'

  import { apiBaseUrl } from "$lib/api";	
  import { rem } from "$lib/spacing";
  import Arrow from '$lib/Arrow.svelte';
  import FullScreen from '$lib/fullscreen/FullScreen.svelte';

  import { afterUpdate } from "svelte";

  export let art: StrapiArt["data"][number];
  export let imageWidth: number;
  export let detailsWidth: number;
  export let showMore: boolean;
  export let gallarySectionHeight: number;
  
  export let paginationDetails: {
    length: number,
    position: number
  }

  export let paginateArtPiece: (n: number) => void;
  export let readMoreClick: (_: boolean) => () => void;
  
  let headlineHeight: number;
  let metaHeight: number;

  let detailsDiv: HTMLDivElement;
  let needsOverflow = false;

  let freshImage = true;
  $: if (art) freshImage = true;
  
  const setOverflow = () => {
    needsOverflow = detailsDiv.scrollHeight > detailsDiv.clientHeight;
    freshImage = false
  };
    
  afterNavigate(setOverflow);
  afterUpdate(() => {
    console.log("afterUpdate", freshImage)
    console.log("needs overflow? ", detailsDiv.scrollHeight > detailsDiv.clientHeight)
    if (freshImage ) setOverflow();
  });
 
 
</script>
<article>
  <figure>
    <div  class="image-wrap" style={`width: ${imageWidth}%`}>
      <img
        src={`${apiBaseUrl}${art.attributes.image.data.attributes.url}`} 
        alt={art.attributes.description} 
      />
      <FullScreen img={art} />

    </div>
    <figcaption style={`width: ${detailsWidth}%`}>
      <div>
        <h3 bind:clientHeight={headlineHeight}>{art.attributes.title}</h3>
        <div 
          bind:this={detailsDiv}
          class={`md-content ${!showMore ? "overflow" : ""}`}
          style={`height: ${`${(gallarySectionHeight * rem - (4 * rem) - metaHeight - headlineHeight - (rem * 2)) / rem}rem;`}`}
        >
          <SvelteMarkdown source={art.attributes.description} />
        </div>
      </div>
      <div class="details-foot" bind:clientHeight={metaHeight}>
        <div>
          <div class="meta">
            <b>date: </b>
            {new Date(art.attributes.createdDate).getFullYear()}
          </div>
          <div class="meta">
            <b>medium:</b>
            {art.attributes.medium}
          </div>
        </div>
        <div>
          {#if needsOverflow}
            <div class="readmore" on:click={readMoreClick(!showMore ? true : false)}>
              {!showMore ? "read less" : "read more"}
            </div>
          {/if}
          <div class="pagination">
            {#if paginationDetails.position !== 0 }
              <span on:click={() => paginateArtPiece(-1)}>
                <Arrow color="blue" size="small" direction="left" />
                last
              </span>
            {/if}
            {#if paginationDetails.position !== 0 && paginationDetails.position + 1 !== paginationDetails.length }
              |
            {/if}
            {#if paginationDetails.position + 1  <= paginationDetails.length}
              <span on:click={() => paginateArtPiece(1)}>
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

<style>
  article {
    height: var(--gallery-section-height);
    width: 100%;
    max-width: var(--wrapper-width);
    border-left: var(--border-md);
    border-right: var(--border-md);
    display: flex;
    justify-content: center;
  }
  figure {
    display: flex;
    width: 90%;
  }
  .image-wrap {
    display: flex;
    justify-content: flex-end;
    position: relative;
  }
  img {
    width: 100%;
    object-fit: cover;
  }
  figcaption {
    overflow: hidden;
    padding-left: 2rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .pagination {
    margin-top: 0.5rem;
    color: var(--off-bk);
    text-align: right;
    margin-right: 0.25rem;
  }
  .md-content {
    overflow: hidden;
    position: relative;
  }
  .md-content:after {
    content: "";
    position: absolute;
    bottom: 0;
    right: 0;
    width: 100%;
    background: linear-gradient(180deg, transparent 30%, var(--w-lt) 70%);
    height: 3rem;
  }
  .overflow {
    overflow:scroll;
  }
  .overflow:after {
    height: 0;
  }
  .meta {
    font-size: 0.9rem;
    margin-bottom: var(--space-lg);
  }
  .details-foot {
    display: flex;
    justify-content: space-between;
  }

  span,
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
    margin-top:-0.25rem;
  }
  span:first-of-type {
    padding-right: 0.25rem;
  }
  span:last-of-type {
    padding-left: 0.25rem;
  }

</style>
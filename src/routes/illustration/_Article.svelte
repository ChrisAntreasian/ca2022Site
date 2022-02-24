<script lang="ts">

  import { afterNavigate } from '$app/navigation';
  import type { StrapiArt } from "../../lib/types";
  
  import { afterUpdate, onMount } from "svelte";
  import { apiBaseUrl } from "../../lib/api";	
  import { rem } from "../../lib/spacing";
  import SvelteMarkdown from 'svelte-markdown'

  export let art: StrapiArt["data"][number];
  export let imageWidth: number;
  export let detailsWidth: number;
  export let showMore: boolean;
  export let readMoreClick: (_: boolean) => () => void;
  
  let containerHeight: number;
  let headlineHeight: number;
  let metaHeight: number;

  let detailsDiv: HTMLDivElement;
  let needsOverflow = false;

  const setOverflow = () => {
    needsOverflow = detailsDiv.scrollHeight > detailsDiv.clientHeight
  }

  afterNavigate(setOverflow);

</script>

<article>
  <figure>
    <div class="image-wrap" style={`width: ${imageWidth}%`}>
      <img 
        src={`${apiBaseUrl}${art.attributes.image.data.attributes.url}`} 
        alt={art.attributes.description} 
      />
    </div>
    <figcaption bind:clientHeight={containerHeight} style={`width: ${detailsWidth}%`}>
      <div>
        <h3 bind:clientHeight={headlineHeight}>{art.attributes.title}</h3>
        <div 
          bind:this={detailsDiv}
          class={`md-content ${!showMore ? "overflow" : ""}`}
          style={`max-height: ${`${(containerHeight - metaHeight - headlineHeight - rem * 2) / rem}rem;`}`}
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
        {#if needsOverflow}
          <div class="readmore" on:click={readMoreClick(!showMore ? true : false)}>
            {!showMore ? "read less" : "read more"}
          </div>
        {/if}
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
  .readmore {
    color: white;
    font-weight: bold;
    background: var(--bg-lt);
    border-radius: var(--space-lg);
    height: 2rem;
    padding: 0 1rem;
    line-height: 2rem;
  }
  .readmore:hover {
    background: var(--b-lt)
  }
</style>
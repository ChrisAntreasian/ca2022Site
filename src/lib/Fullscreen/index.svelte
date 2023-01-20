<script lang="ts">
  import { scale, fade } from "svelte/transition";

  import type { StrapiArt } from "$lib/types";
  import { noScroll } from '$lib/body';
  import fullscreen from "./fullscreen.svg"
  import { rem } from "$lib/spacing";
	import { captureDetails, captureBehavior } from "$lib/analytics";
	import Arrow from "$lib/arrow/Arrow.svelte";

  export let img: StrapiArt["data"][number];
  export let analyticsKey: string;
  export let description: string = null;

  export let paginateArtPiece: (s: string) => (n: number)  => void = null;
  export let paginationDetails: {
    length: number,
    position: number
  } = null;

  let displayBg = false;
  let displayImg = false
  let imageHeight = 0;
  
  const transitionConfig = {duration: 400};
  const mkCaptureDetails = captureDetails({ id: img.id, name: img.attributes.title });
  const open = () => {
    imageHeight = (window.innerHeight - (2 * rem)) / rem;
    displayBg = displayImg = true;
    captureBehavior(`${analyticsKey} click open fullscreen`, mkCaptureDetails );
  }
  const close = () => {
    displayBg = displayImg = false
    captureBehavior(`${analyticsKey} click close fullscreen`,  mkCaptureDetails);
  };
  const paginateFullscreen = paginateArtPiece ? paginateArtPiece(`${analyticsKey} fullscreen`) : null;

</script>

<svelte:body use:noScroll={displayBg} />

<div 
  on:click={open} 
  on:keypress={open} 
  class="btn" 
>
  <img src={fullscreen} alt={"click for fullscreen"} /> 
</div>
{#if displayBg}
  <div class="bg-overlay" 
    on:click={close}
    on:keypress={close}
    transition:fade={transitionConfig}
  />
{/if}
{#if displayImg}

  <div class="wrap" transition:scale={transitionConfig}>
    <div 
      on:click={close} 
      on:keypress={close}
      class="btn close" 
    >
      x
    </div>
    {#if paginateFullscreen && paginationDetails && paginationDetails.position !== 0 }
      <span 
        class="pagination-link last" 
        on:click={() => paginateFullscreen(-1)}
        on:keypress={() => paginateFullscreen(-1)}
      >
        <Arrow color="white" size="large" direction="left" />
      </span>
    {/if}

    <img style={`height: ${imageHeight}rem;`} src={`${img.attributes.image.data.attributes.url}`} alt={img.attributes.image.data.attributes.alternativeText} />

    {#if paginateFullscreen && paginationDetails && paginationDetails.position + 1 < paginationDetails.length}
      <span 
        class="pagination-link next" 
        on:click={() => paginateFullscreen(1)}
        on:keypress={() => paginateFullscreen(1)}
      >
        <Arrow color="white" size="large" direction="right" />
      </span>
    {/if}
  </div>
{/if}

<style>
  .btn {
    position: absolute;
    height: 2rem;
    width: 2rem;
    bottom: 0.5rem;
    right: 0.5rem;
    background: var(--off-bk);
    border-radius: var(--space-md);
    color: white;
    opacity: .85;
    cursor: pointer;
  }
  .btn.close {
    height: 4rem;
    width: 4rem;
    font-size: 3.5rem;
    line-height: 3.5rem;
    text-align: center;
    top: 0;
    right: -6rem;
  }
  .btn:hover {
    opacity: 1;
  }
  .wrap {
    position: fixed;
    z-index: 200;
    top: 1rem;
    left: 50%;
    transform: translate(-50%);
  }
  .pagination-link {
    position: absolute;
    top: 50%;
  }
  .pagination-link.last {
    left: 0;
    margin-left: -4rem;
  }
  .pagination-link.next {
    right: 0;
    margin-right: -4rem;
  }
  @media (max-width: 767.98px) {
    .btn {
      display: none;
    }
  }
</style>
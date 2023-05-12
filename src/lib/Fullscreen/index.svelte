<script lang="ts">
  import { scale, fade } from "svelte/transition";

  import { noScroll } from '$lib/body';
  import fullscreenIcon from "./fullscreen.svg"
  import { fromRem, rem, toRem } from "$lib/spacing";
	import { captureDetails, captureBehavior } from "$lib/analytics";
	import Arrow from "$lib/arrow/Arrow.svelte";
	import { onMount } from "svelte";

  export let id: number;
  export let title: string;
  export let img: string;
  export let altText: string;
  export let analyticsKey: string;
  export let btnOffset: number = 50;
  export let targetImage: string = null;
  export let paginateArtPiece: (s: string) => (n: number)  => void = null;
  export let paginationDetails: {
    length: number,
    position: number
  } = null;
  
  let displayBg = false;
  let displayImg = false
  let imageHeight
  let windowWidth = 0;
  
  const transitionConfig = {duration: 400};
  const mkCaptureDetails = captureDetails({ id: id, name: title });

  let hmw = { h: "auto", mw: "auto" };
  
  const wrapperWidth = fromRem(75)
  onMount(async () => {
    const  i = new Image();
    i.src = img;
    const dfn = i.onload = () => ({ h: i.height, w: i.width });
    const d = dfn();
    hmw = { h: `${(window.innerHeight - (2 * rem)) / rem}rem`, mw: "auto" };

    if (d.w >= d.h) {
      hmw = {
        h: "auto",
        mw: `${toRem((windowWidth <= wrapperWidth ? windowWidth: wrapperWidth) - fromRem(4))}rem`
      }
    }
  });


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

<svelte:window bind:innerWidth={windowWidth} />
<svelte:body use:noScroll={displayBg} />

{#if targetImage}
  <div 
    on:click={open} 
    on:keypress={open} 
    class="img open" 
  >
    <img src={targetImage} alt={"click for fullscreen"} />
  </div>
{:else}
  <div 
    on:click={open} 
    on:keypress={open} 
    class="btn open" 
    style={`--btn-offset: ${btnOffset}%`}
  >
    <img src={fullscreenIcon} alt={"click for fullscreen"} />
  </div>
{/if}

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
    <img 
      src={`${img}`} 
      alt={altText} 
      class="fs" 
      style={`
        --height: ${hmw.h};
        --max-width: ${hmw.mw};
      `} 
    />
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
  .img,
  .btn {
    cursor: pointer;
  }
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
  }

  .img img {
    height: auto;
    width: 20rem;
    margin-left: -25%;
    object-fit: fill;
  }
  
  img.fs {
    height: var(--height);
    max-width: var(--max-width);
  }
  .btn.open {
    left: var(--btn-offset);
    margin-left: -3rem;
    z-index: 1;
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
    .btn,
    .bg-overlay,
    .wrap {
      display: none;
    }
  }
</style>
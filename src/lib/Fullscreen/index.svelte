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
  export let paginateItem: (s: string) => (n: number)  => void = null;
  export let paginationDetails: {
    length: number,
    position: number
  } = null;
  
  export let onClose = () => null;

  let displayBg = false;
  let displayImg = false
  let imageHeight
  let windowWidth = 0;
  
  const transitionConfig = {duration: 400};
  const mkCaptureDetails = captureDetails({ id: id, name: title });

  let hmw = { h: "auto", mw: "auto" };
  
  const wrapperWidth = fromRem(75);

  let maxOverlayWidth = 0
  $: maxOverlayWidth = (windowWidth <= wrapperWidth ? windowWidth: wrapperWidth) - fromRem(4);

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
    displayBg = displayImg = false;
    onClose();
    captureBehavior(`${analyticsKey} click close fullscreen`,  mkCaptureDetails);
  };
  
  const paginateFullscreen = paginateItem ? paginateItem(`${analyticsKey} fullscreen`) : null;
  let needsNext = false;
  let needsLast = false;
  $: needsLast = paginateFullscreen && paginationDetails && paginationDetails.position + 1 < paginationDetails.length;
  $: needsNext = paginateFullscreen && paginationDetails && paginationDetails.position !== 0;

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
    class="btn btn-bg open" 
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
      class="close-control modal-control-wrap" 
      style={`--width: ${toRem(maxOverlayWidth) - 2}rem`}
    >
      <div
        on:click={close}
        on:keypress={close}
        class="btn btn-bg close"
      >
        x
      </div>
    </div>
    <img 
      src={`${img}`} 
      alt={altText} 
      class="fs" 
      style={`
        --height: ${hmw.h};
        --max-width: ${hmw.mw};
      `} 
    />
   
  </div>
   {#if needsLast || needsNext}
      <div class="page-control modal-control-wrap"
        style={`--width: ${toRem(maxOverlayWidth) - 2}rem`}
      >
        <span 
          class:disabled={!needsNext}
          class="pagination-link last btn-bg" 
          on:click={() => paginateFullscreen(-1)}
          on:keypress={() => paginateFullscreen(-1)}
        >
          <Arrow color="white" size="medium" direction="left" />
        </span>
        <span 
          class:disabled={!needsLast}
          class="pagination-link next btn-bg" 
          on:click={() => paginateFullscreen(1)}
          on:keypress={() => paginateFullscreen(1)}
        >
          <Arrow color="white" size="medium" direction="right" />
        </span>
      </div>
    {/if}
{/if}

<style>
  .img,
  .btn {
    cursor: pointer;
  }
  .btn-bg {
    background: var(--off-bk);
    border-radius: var(--space-md);
    color: white;
    opacity: .85;
  }
  .btn {
    height: 2rem;
    width: 2rem;
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
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    left: var(--btn-offset);
    margin-left: -3rem;
    z-index: 1;
  }
  .btn.close {
    height: 3.5rem;
    width: 3.5rem;
    font-size: 3rem;
    line-height: 3.5rem;
    text-align: center;
    top: 0;
    left: 0;
    margin-left: var(--position);
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
  .modal-control-wrap {
    position:fixed;
    width: var(--width);
    left: 50%;
    transform: translate(-50%);
    display: flex;
  }
  
  .close-control {
    justify-content: flex-end;
    top: 0;
  }
  .page-control {
    justify-content: center;
  }
  .pagination-link.disabled {
    pointer-events: none;
    cursor: default;
    opacity: 0;
  }
  .pagination-link.last {
    margin-right: 3rem;
  }
  .pagination-link.next {
    margin-left: 3rem;
  }
  @media (max-width: 767.98px) {
    .btn,
    .bg-overlay,
    .wrap {
      display: none;
    }
    .img {
      cursor: default;
      pointer-events: none;
    }
    .img img {
      width: 100%;
      height: auto;
      margin-left: 0;
    }
  }
</style>
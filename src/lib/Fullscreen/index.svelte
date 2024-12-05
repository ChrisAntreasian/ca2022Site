<script lang="ts">
  import { run } from 'svelte/legacy';

  import { scale, fade } from "svelte/transition";

  import { noScroll } from '$lib/body';
  import fullscreenIcon from "./fullscreen.svg"
  import { fromRem, rem, toRem } from "$lib/spacing";
	import { captureDetails, captureBehavior } from "$lib/analytics";
	import Arrow from "$lib/arrow/Arrow.svelte";
	import { onMount } from "svelte";

  
  interface Props {
    id: number;
    title: string;
    img: string;
    altText: string;
    analyticsKey: string;
    btnOffset?: number;
    targetImage?: string;
    paginateItem?: (s?: string) => (n: number)  => void;
    paginationDetails?: {
    length: number,
    position: number
  };
    onClose?: any;
    onOpen?: any;
  }

  let {
    id,
    title,
    img,
    altText,
    analyticsKey,
    btnOffset = 50,
    targetImage = null,
    paginateItem = null,
    paginationDetails = null,
    onClose = () => null,
    onOpen = (_: number) => null
  }: Props = $props();

  let displayBg = $state(false);
  let displayImg = $state(false)
  let imageHeight
  let windowWidth = $state(0);
  
  const transitionConfig = {duration: 400};
  const mkCaptureDetails = captureDetails({ id: id, name: title });

  let hmw = $state({ h: "auto", mw: "auto" });
  
  const wrapperWidth = fromRem(75);

  let maxOverlayWidth = $state(0)
  run(() => {
    maxOverlayWidth = (windowWidth <= wrapperWidth ? windowWidth: wrapperWidth) - fromRem(4);
  });

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
    onOpen(id);
  });
  
  const open = () => {
    imageHeight = (window.innerHeight - (2 * rem)) / rem;
    displayBg = displayImg = true;
    onOpen(id);
    captureBehavior(`${analyticsKey} click open fullscreen`, mkCaptureDetails );
  }
  const close = () => {
    displayBg = displayImg = false;
    onClose();
    captureBehavior(`${analyticsKey} click close fullscreen`,  mkCaptureDetails);
  };
  
  let needsNext = $state(false);
  let needsLast = $state(false);

  const paginateFullscreen = paginateItem ? paginateItem(`${analyticsKey} paginate fullscreen`) : null;
  const setNeedsLast = () => paginateFullscreen && paginationDetails && paginationDetails.position + 1 < paginationDetails.length;
  const setNeedsFirst = () => paginateFullscreen && paginationDetails && paginationDetails.position !== 0
  
  run(() => {
    if(paginateFullscreen || paginationDetails) {
      needsLast = setNeedsLast();
      needsNext = setNeedsFirst();
    }
  });;
 
</script>

<svelte:window bind:innerWidth={windowWidth} />
<svelte:body use:noScroll={displayBg} />

{#if targetImage}
  <div 
    onclick={open} 
    onkeypress={open} 
    class="img open" 
  >
    <img src={targetImage} alt={"click for fullscreen"} />
  </div>
{:else}
  <div 
    onclick={open} 
    onkeypress={open} 
    class="btn btn-bg open" 
    style={`--btn-offset: ${btnOffset}%`}
  >
    <img src={fullscreenIcon} alt={"click for fullscreen"} />
  </div>
{/if}

{#if displayBg}
  <div class="bg-overlay"
    onclick={close}
    onkeypress={close}
    transition:fade|global={transitionConfig}
></div>
{/if}

{#if displayImg}
  <div class="wrap" transition:scale|global={transitionConfig}>
    <div 
      class="close-control modal-control-wrap" 
      style={`--width: ${toRem(maxOverlayWidth) - 2}rem`}
    >
      <div
        onclick={close}
        onkeypress={close}
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
    {#if needsLast || needsNext}
      <div class="page-control modal-control-wrap"
        style={`--width: ${toRem(maxOverlayWidth) - 2}rem`}
      >
        <span 
          class:disabled={!needsNext}
          class="pagination-link last btn-bg" 
          onclick={() => paginateFullscreen(-1)}
          onkeypress={() => paginateFullscreen(-1)}
        >
          <Arrow color="white" size="medium" direction="left" />
        </span>
        <span 
          class:disabled={!needsLast}
          class="pagination-link next btn-bg" 
          onclick={() => paginateFullscreen(1)}
          onkeypress={() => paginateFullscreen(1)}
        >
          <Arrow color="white" size="medium" direction="right" />
        </span>
      </div>
    {/if}
  </div>

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
    height: 100%;
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translate(-50%);
    z-index: 200;
    
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
    position: absolute;
    bottom: 2rem;
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
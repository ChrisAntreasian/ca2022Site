<script lang="ts">
  import type { StrapiArt } from "../../../../lib/types";

  import { scale, fade } from "svelte/transition";

  import fullscreen from "./fullscreen.svg"
  import { apiBaseUrl } from "$lib/api";	
  import { rem } from "$lib/spacing";

  export let img: StrapiArt["data"][number];

  let displayBg = false;
  let displayImg = false
  let imageHeight = 0;

  const transitionConfig = {duration: 400};

  const open = () => {
    imageHeight = (window.innerHeight - (2 * rem)) / rem;
    displayBg = displayImg = true;
  }
  const close = () => displayBg = displayImg = false;
  
</script>

<div on:click={open} class="btn" >
  <img src={fullscreen} alt={"click for fullscreen"} /> 
</div>
{#if displayBg}
  <div class="bg-overlay" 
    on:click={close}
    transition:fade={transitionConfig}
  />
{/if}
{#if displayImg}
  <div class="wrap" transition:scale={transitionConfig}>
    <div on:click={close} class="btn close" >x</div>
    <img style={`height: ${imageHeight}rem;`} src={`${apiBaseUrl}${img.attributes.image.data.attributes.url}`} alt={img.attributes.image.data.attributes.alternativeText} />
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
  @media (max-width: 767.98px) {
    .btn {
      display: none;
    }
  }
</style>
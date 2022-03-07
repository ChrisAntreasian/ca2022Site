<script lang="ts">
  import type { StrapiArt } from "./../types";

  import fullscreen from "./fullscreen.svg"
  import { apiBaseUrl } from "$lib/api";	

  export let img: StrapiArt["data"][number];

  import { tweened } from 'svelte/motion';
  import { cubicOut } from "svelte/easing";
  import { rem } from "$lib/spacing";

  let displayed = false;
  let imageHeight = 0;
  const tween = {
		easing: cubicOut,
    duration: 700,
  }
  const bgOpacity = tweened(0, tween);
  const imgOpacity = tweened(0, tween);
  const open = () => {
    imageHeight = (window.innerHeight - (4 * rem)) / rem;
    displayed = true;
    bgOpacity.set(80);
    imgOpacity.set(100);
  }
  const close = () => {
    displayed = false;
    bgOpacity.set(0);
    imgOpacity.set(0);
  }
</script>

<div on:click={open} class="btn" >
  <img src={fullscreen} alt={"click for fullscreen"} /> 
</div>
<div class={`bg ${displayed? "displayed" : ""}`} style={`opacity: ${$bgOpacity / 100}`}> 
</div>
<div class={`wrap ${displayed ? "displayed": ""}`} style={`opacity: ${$imgOpacity / 100}`}>
  <div on:click={close} class="btn close" >x</div>
  <img style={`height: ${imageHeight}rem;`} src={`${apiBaseUrl}${img.attributes.image.data.attributes.url}`} alt={img.attributes.image.data.attributes.alternativeText} />
</div>

<style>
  .bg {
    position: fixed;
    width: 100%;
    top: 0;
    bottom: 0;
    background: var(--off-bk);
    display: none;
    justify-content: center;
    align-items: center;
    opacity: 0;
    right: 0;
    z-index: 100;
  }
  .bg.displayed {
    display: flex;
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
    opacity: 1
  }
  .wrap {
    display: none;
    position: fixed;
    z-index: 200;
    top: 2rem;
    left: 50%;
    transform: translate(-50%)

  }
  .wrap.displayed {
    display:block;
  }

</style>
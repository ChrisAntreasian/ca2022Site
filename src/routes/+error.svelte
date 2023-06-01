<script lang="ts">
  import { page } from "$app/stores";
	import { contextHeightKey, rem } from "$lib/spacing";
  import type { LayoutElemH } from "$lib/spacing";
	import { getContext } from 'svelte';
  
  let windowHeight;
  const { getHeaderHeight, getFooterHeight }: LayoutElemH = getContext(contextHeightKey);
  const image =  [500, 404, 403].includes($page.status)  ? `/${$page.status}.jpg` : "/500.jpg";
 
</script>

<svelte:window bind:innerHeight={windowHeight} />

<section style={`--min-height: ${(windowHeight - getHeaderHeight() - getFooterHeight()) / rem}rem`}>
  <div>
    <h3>{$page.status}</h3>
    <h4>: {$page.error.message}</h4>
  </div>
  <img src={image} alt={`${$page.status} image`} />
  
</section>

<style>
  section {
    margin: 4rem 0 2rem;
    flex-direction: column;
    align-items: center;
    min-height: var(--min-height);
  }
  div {
    display: flex;
    margin-bottom: 1rem;
  }
  h3 {
    color: var(--off-bk);
  }
  h4 { 
    line-height: var(--header-height);
  }
</style>
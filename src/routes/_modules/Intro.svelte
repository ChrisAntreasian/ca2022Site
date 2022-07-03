<script lang="ts">
  import type { StrapiPageDetails } from "$lib/types";
  import { apiBaseUrl } from "$lib/api";
	import { safeImageString } from "$lib/image";	
  import { getContext } from "svelte";
	import { contextHeightKey, rem } from "$lib/spacing";
  
	export let intro: StrapiPageDetails;
  const { getHeaderHeight, getFooterHeight } = getContext(contextHeightKey);
  let windowHeight: number;

</script>

<svelte:window bind:innerHeight={windowHeight} />

<section class="home" style={`--min-height: ${(windowHeight - getHeaderHeight() - getFooterHeight()) / rem}rem`}>
  {#each intro as sec}
    <div class="intro-segment">
      <div>
        <h1>{sec.attributes.title}</h1>
        <p>{sec.attributes.description}</p>
      </div>
      {#if sec.attributes.art_piece}
        <img 
          src={`${apiBaseUrl}${safeImageString("medium")(sec.attributes.image)}`} 
          alt={sec.attributes.title} 
        />
      {/if}
    </div>
  {/each}
</section>

<style>
  section {
    flex-basis: 50%;
    min-height: var(--min-height);
    padding: 1rem;
    margin-top: 0;
  }
  h1 {
    margin-top: 2rem;
    padding-bottom: 0;
    font-size: 2.5rem;
    text-align: left;
  }
  .intro-segment{
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
	}
  img {
    width: 100%;
    justify-self: flex-end;
  }
</style>
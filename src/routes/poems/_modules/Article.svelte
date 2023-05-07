

<script lang="ts">
	import type { Poem, WithId } from "$lib/types";

	import Article from "$lib/Article/Article.svelte"

	export let poem: WithId<Poem>;
	export let subnavHeight: number;
	export let measureH: number;
  export let scrollRequestUpdate: boolean;

	let windowHeight: number;

</script>

<svelte:window bind:innerHeight={windowHeight} />

<Article 
	poem={poem}
	subnavHeight={subnavHeight}
	measureH={measureH}
	scrollRequestUpdate={scrollRequestUpdate}
/>
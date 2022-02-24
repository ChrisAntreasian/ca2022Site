<script  context="module" lang="ts">
	import Header from '$lib/Header.svelte';
	import Footer from '$lib/Footer.svelte';
	import '../app.css';
	import type { Load } from '@sveltejs/kit';
	import type { StrapiArt, Art } from "$lib/types";

	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/json');
		if (res.ok) {
			const artResp: StrapiArt = await res.json();
			const art = artResp.data[0].attributes
			return {
				props: { 
					art: art
				},
			};
		}
	}
</script>

<script lang="ts">
	export let art: Art;
</script>

<Header art={art}/>

<main>
	<slot />
</main>

<Footer />

<style>
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: var(--wrapper-width);
		box-sizing: border-box;
		margin: 0 auto;
	}

</style>

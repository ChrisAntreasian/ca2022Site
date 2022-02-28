<script  context="module" lang="ts">
	import Header from '$lib/Header.svelte';
	import Footer from '$lib/Footer.svelte';
	import '../app.css';
	import type { Load } from '@sveltejs/kit';
	import type { StrapiArt, Art } from "$lib/types";
	import { setContext } from "svelte";
	import { contextHeightKey } from '$lib/spacing';

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
	
	export let headerHeight: number;
	export let footerHeight: number;
	setContext(
		contextHeightKey,
		{ 
			getHeaderHeight: () => headerHeight, 
			getFooterHeight: () => footerHeight
		}
	)
</script>

<Header art={art} bind:headerHeight={headerHeight} />
<main>
	<slot />
</main>

<Footer bind:footerHeight={footerHeight} />

<style>
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		box-sizing: border-box;
		margin: 0 auto;
		align-items: center;
	}

</style>

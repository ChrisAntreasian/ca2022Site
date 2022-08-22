<script  context="module" lang="ts">
	import Header from './_modules/Header.svelte';
	import Footer from './_modules/Footer.svelte';
	import '../app.css';

	import type { Load } from '@sveltejs/kit';
	import type { PageDetails, StrapiApiResp, StrapiImageData } from "$lib/types";
	import { setContext } from "svelte";
	import { contextHeightKey } from '$lib/spacing';

	export const load: Load = async ({ fetch }) => {
		const res = await fetch('/layout.json');
		if (res.ok) {
			
			const dets: StrapiApiResp<PageDetails> = await res.json();
			const logo = dets.data[0].attributes.image;

			return {
				props: { 
					logo: dets.data[0].attributes.image,
					title: dets.data[0].attributes.title
				}
			};
		}
	}
</script>

<script lang="ts">
	export let logo: StrapiImageData;
	export let title: string;

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

<Header {logo} {title} bind:headerHeight={headerHeight} />
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
		max-width: var(--wrapper-width);
		border-left: var(--space-md) solid var(--p-dk);
		border-right: var(--space-md) solid var(--b-dk);
		background: var(--w-xl)
	}
</style>

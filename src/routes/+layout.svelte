
<script lang="ts">	
	import '../app.css';

	import { setContext } from "svelte";
	import { contextHeightKey } from '$lib/spacing';
	
	import Header from './_modules/Header.svelte';
	import Footer from './_modules/Footer.svelte';

	import type { LayoutServerData } from "./$types";

	export let headerHeight: number;
	export let footerHeight: number;
	export let data: LayoutServerData;
	
	setContext(
		contextHeightKey,
		{ 
			getHeaderHeight: () => headerHeight, 
			getFooterHeight: () => footerHeight
		}
	)
</script>

<Header logo={data.logo} title={data.title} bind:headerHeight={headerHeight} />
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

<script lang="ts">	
	import '../app.css';

	import { setContext } from "svelte";
	import { contextHeightKey } from '$lib/spacing';
	
	import Header from './_modules/Header.svelte';
	import Footer from './_modules/Footer.svelte';

	import type { LayoutServerData } from "./$types";
	import { initMixpanel } from '$lib/analytics';

	export let headerHeight: number;
	export let footerHeight: number;

	export let data: LayoutServerData;
	
	initMixpanel();
	
	setContext(
		contextHeightKey,
		{ 
			getHeaderHeight: () => headerHeight, 
			getFooterHeight: () => footerHeight,
		}
	)

</script>

<Header 
	logo={data.logo} 
	title={data.title}
	mobileTitle={data.mobileTitle}
	bind:headerHeight={headerHeight} 
/>

<main>
	<slot />
</main>

<Footer bind:footerHeight={footerHeight} />

<style>
	main {
		width: 100%;
		max-width: var(--wrapper-width);
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		margin: 0 auto;
		border-left: var(--space-md) solid var(--p-dk);
		border-right: var(--space-md) solid var(--b-dk);
		background: var(--w-xl)
	}
	@media (max-width: 767.98px) { 
		main {
			border: none;
		}
	}
</style>

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
		position: relative;
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

	main:before, main:after {
		content: "";
		display: block;
		position: absolute;
		height: 100%;
		width: 64rem;
		z-index: -99;
		opacity: 0.6;
		top: 0;
		background: repeating-conic-gradient(
			var(--b-dk) 0 2%,
			var(--b-lt) 0 4%
		) 80%;
		background-blend-mode: multiply;
		background-size: 64rem 64rem;
		background-color: transparent;
		background-position: top;
		mix-blend-mode: luminosity;
	}
	main:before {
		left: 0;
		margin-left: -30rem
	}
	main:after {
		right: 0;
		margin-right: -30rem
	}
	@media (max-width: 767.98px) { 
		main {
			border: none;
		}
	}
</style>

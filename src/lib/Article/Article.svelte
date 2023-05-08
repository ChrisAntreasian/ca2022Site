

<script lang="ts">
	import { fade } from "svelte/transition";
	import SvelteMarkdown from 'svelte-markdown'

	import { contextHeightKey, rem, type LayoutElemH } from "$lib/spacing";
	import { getContext } from "svelte";
	import type { Item } from "./types";

	export let item: Item;
	export let subnavHeight: number;
	export let measureHeight: number;
  export let scrollRequestUpdate: boolean;

	let fadeOut = false;
	let windowHeight: number;

	const { getHeaderHeight }: LayoutElemH = getContext(contextHeightKey);

</script>

<svelte:window bind:innerHeight={windowHeight} />

<article 
style={`
	--min-height: ${(windowHeight - getHeaderHeight()) / rem}rem;
	--snh: ${subnavHeight / rem}rem;
`}>
	{#key scrollRequestUpdate}
	<div bind:offsetHeight={measureHeight} class="mh" />
	{/key}
	<div class="wrap">
		{#key item.id}
			<div
				class:transition={fadeOut}
				in:fade={{duration: 500, delay: 50}}
				out:fade={{duration: 300}}
				on:outrostart="{() => {fadeOut = true}}"
				on:introend="{() => {fadeOut = false}}"
			>
			<h3>{item.title}</h3>
				<SvelteMarkdown source={item.body} />
			</div>
		{/key}
	</div>
</article>

<style>
	article, .wrap {
		width: 66.66%;
		position: relative;
	}
	article {
		display: flex;
		justify-content: center;
		min-height: var(--min-height);
		padding: 1.3333rem 0 2rem;

	}

	@media (max-width: 767.98px) {
		article, .wrap {
			width:100%;
		}
		article {
			padding: 1.3333rem 1rem calc(var(--snh) + 2rem);
		}
		.wrap {
			max-width: 30rem;
		}
		h3 {
			display: none;
		}
	}
</style>
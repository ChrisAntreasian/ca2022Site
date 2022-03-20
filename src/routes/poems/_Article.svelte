

<script lang="ts">
	import { fade } from "svelte/transition";
	import SvelteMarkdown from 'svelte-markdown'

  import type { StrapiPoem } from "$lib/types";
	import { contextHeightKey, rem } from "$lib/spacing";
	import { getContext } from "svelte";

	export let poem: StrapiPoem["data"][number];
	
	let fadeOut = false;
	let windowHeight: number;

	const { getHeaderHeight, getFooterHeight } = getContext(contextHeightKey);

</script>

<svelte:window bind:innerHeight={windowHeight} />

<article style={`min-height: ${(windowHeight - getHeaderHeight()) / rem}rem`}>
	{#key poem.id}
		<div class:absolute={fadeOut}
			in:fade={{duration: 300, delay: 50}}
			out:fade={{duration: 300}}
			on:outrostart="{() => {fadeOut = true}}"
			on:introend="{() => {fadeOut = false}}"

		>
			<h3>{poem.attributes.title}</h3>
			<SvelteMarkdown source={poem.attributes.body} />
		</div>
	{/key}
</article>

<style>
	article {
		padding: 1.3333rem 0 2rem;
		width: 66.66%;
		display: flex;
		justify-content: center;
		position: relative;
	}
	.absolute {
		position: absolute;
	}
	div {
		width: 66.66%;
	}
</style>
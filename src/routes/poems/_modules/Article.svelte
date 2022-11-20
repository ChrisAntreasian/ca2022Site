

<script lang="ts">
	import { fade } from "svelte/transition";
	import SvelteMarkdown from 'svelte-markdown'

  import type { StrapiPoem } from "$lib/types";
	import { contextHeightKey, rem, type LayoutElemH } from "$lib/spacing";
	import { getContext } from "svelte";

	export let poem;
	
	let fadeOut = false;
	let windowHeight: number;

	const { getHeaderHeight }: LayoutElemH = getContext(contextHeightKey);

</script>

<svelte:window bind:innerHeight={windowHeight} />

<article style={`--min-height: ${(windowHeight - getHeaderHeight()) / rem}rem`}>
	<div class="wrap">
		{#key poem.id}
			<div
				class:transition={fadeOut}
				in:fade={{duration: 500, delay: 50}}
				out:fade={{duration: 300}}
				on:outrostart="{() => {fadeOut = true}}"
				on:introend="{() => {fadeOut = false}}"
			>
				<h3>{poem.attributes.title}</h3>
				<SvelteMarkdown source={poem.attributes.body} />
			</div>
		{/key}
	</div>
</article>

<style>
	article {
		padding: 1.3333rem 0 2rem;
		width: 66.66%;
		display: flex;
		justify-content: center;
		position: relative;
		min-height: var(--min-height);
	}
	.wrap {
		width: 66.66%;
		position: relative;
	}
	@media (max-width: 767.98px) {
		article {
			width:100%;
			padding: 1.3333rem 1rem 2rem;
		}
		.wrap {
			width: 100%;
			max-width: 30rem;
		}
		h3 {
			display: none;
		}
	}
</style>
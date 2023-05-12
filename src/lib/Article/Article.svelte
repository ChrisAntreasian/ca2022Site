

<script lang="ts">
	import { fade } from "svelte/transition";
	import SvelteMarkdown from 'svelte-markdown'

	import { contextHeightKey, rem, type LayoutElemH } from "$lib/spacing";
	import { getContext } from "svelte";
	import type { Item } from "./types";
	import Fullscreen from "$lib/Fullscreen/index.svelte"
	export let item: Item;
	export let subnavHeight: number;
	export let measureHeight: number;
  export let scrollRequestUpdate: boolean;
	export let analyticsKey: string;

	let fadeOut = false;
	let windowHeight: number;

	const { getHeaderHeight }: LayoutElemH = getContext(contextHeightKey);
	
	const makeLinkText = (l: string) => {
		const brokenup = l.split("//")[1].split("/");
		const domain = `${brokenup[0].split(".")[1]}.${brokenup[0].split(".")[2]}`;
		return domain === "betterlesson.com" 
			? `${domain}/${brokenup[brokenup.length - 1]}`
			: domain
	}

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
				{#if item.logo}
					<img src={item.logo} alt={item.title} />
				{:else}
					<h3>{item.title}</h3>
				{/if}

				{#if item.link}
					<div>
						<a href={item.link} target="_blank" rel="noreferrer">
							{makeLinkText(item.link)}
						</a>
					</div>
				{/if}
				{#if item.secondLink}
					<div>
						<a href={item.secondLink} target="_blank" rel="noreferrer">
							{makeLinkText(item.secondLink)}
						</a>
					</div>
				{/if}

				<SvelteMarkdown source={item.body} />
				<ul>
					{#if item.images}
						{#each item.images as _, i}
							<li>
								<Fullscreen 
									id={item.id + i}
									title={item.title}
									img={_.large}
									targetImage={_.small}
									analyticsKey={analyticsKey}
									altText={`${item.title} screenshot ${i + 1}`}
								/>
							</li>
						{/each}
					{/if}
				</ul>
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
		padding: 1.3333rem 1rem 2rem ;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		margin-top: 1rem;
	}
	li {
		display: flex;
		width: calc(33.333% - 0.5rem);
		aspect-ratio : 1 / 0.75;
		border: var(--space-md) solid var(--bg-dk);
		border-radius: 0.333rem;
		box-sizing: border-box;
		overflow: hidden;
		margin-bottom: 0.75rem;
		transition : border 250ms ease-out;

	}
	li:hover {
		border-color: var(--bg-lt);
	}
	img {
		height: 4rem;
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
		img {
			padding-top: 1rem;
			height: 3rem;
		}
	}
</style>
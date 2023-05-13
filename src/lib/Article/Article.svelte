

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
	
	const defaultActiveShot = { i: null, src: null };
	
	let activeShot: { i: number, src: string } = defaultActiveShot; 
	const resetFullScreen = () => {
		activeShot = defaultActiveShot
	}

	let paginationDetails = {
		length: item.images ? item.images.length : 0,
		position: 0
	}
	const setPaginationDetails = (id: number) => {
		 paginationDetails = {
			position:  item.images.findIndex(_ => _.id === id),
			length: item.images ? item.images.length : 0
		 }
	}
	
	$: if (item.images) setPaginationDetails(item.images[0].id);

	const paginateItem = () => (n: number) => {
		const index = item.images.findIndex(_ => _.id === item.images[activeShot.i + n].id);
		setPaginationDetails(item.images[index].id);
		activeShot = {i: index, src: item.images[index].large}
	}

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

				{#if item.images}
					<h4>Screenshots</h4>
					<ul>
						{#each item.images as _, i}
							<li>
								<Fullscreen 
									id={item.id + (activeShot.i || i)}
									title={item.title}
									img={activeShot.src || _.large}
									targetImage={_.small}
									analyticsKey={analyticsKey}
									altText={`${item.title} screenshot ${(activeShot.i || i) + 1}`}
									paginationDetails={paginationDetails}
									paginateItem={paginateItem}
									onClose={resetFullScreen}
								/>
							</li>
						{/each}
					</ul>
				{/if}
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
	h4 {
		margin-top: 1rem;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		margin-top: 0.5rem;
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
		ul {
			flex-direction: column;
			align-items: center;
		}
		li {
			width: 100%;
			aspect-ratio: initial;
			border: none;
			justify-content: center;
		}
	}
</style>
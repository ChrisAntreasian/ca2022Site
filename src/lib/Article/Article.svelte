

<script lang="ts">
	import { fade } from "svelte/transition";
	import SvelteMarkdown from 'svelte-exmarkdown'

	import { contextHeightKey, rem, type LayoutElemH } from "$lib/spacing";
	import { getContext } from "svelte";
	import type { Item } from "./types";
	import Fullscreen from "$lib/Fullscreen/index.svelte"
	import { captureBehavior, captureDetails } from "$lib/analytics";

	

	interface Props {
		/*
		FireFox Screenshot dimensions
		Mobile Screenshot Window dimensions: (450px, 688px)
		Desktop Screenshot Window dimensions: (144px, 688px)
		Gimp Modification dimensions
		Desktop: position (115, 306) dimensions (2886, 1550)
		Mobile: position: (118, 306) dimensions (892, 1324)
	*/
		item: Item;
		subnavHeight: number;
		measureHeight: number;
		scrollRequestUpdate: boolean;
		analyticsKey: string;
		wrapBasis: number;
	}

	let {
		item,
		subnavHeight,
		measureHeight = $bindable(),
		scrollRequestUpdate,
		analyticsKey,
		wrapBasis
	}: Props = $props();

	const { getHeaderHeight }: LayoutElemH = getContext(contextHeightKey);

	let fadeOut = $state(false);
	let windowHeight: number = $state();
	let md = $state(item.body);
	const defaultActiveShot = { i: null, src: null };
	
	let paginationDetails = $state(null);
	let activeShot: { i: number, src: string } = $state(defaultActiveShot); 
	
	const resetFullScreen = () => {
		activeShot = defaultActiveShot;
		paginationDetails = null;
	}

	const setPaginationDetails = (id: number) => {
		 paginationDetails = {
			position:  item.images.findIndex(_ => _.id === id),
			length: item.images ? item.images.length : 0
		 }
	}
	
	const paginateItem = (k?: string) => (n: number) => {
		const index = item.images.findIndex(_ => _.id === item.images[activeShot.i + n].id);
		const {id, large} = item.images[index]

		setPaginationDetails(id);
		activeShot = {i: index, src: large}

		if (k) {
			captureBehavior(
				`${k} click paginate`, 
				captureDetails(
					{ id: activeShot.i + n, name: `${item.title} screenshot ${activeShot.i}` },
					{ direction: n > 0 ? "next" : "last" }
				)
			);
		}
	}

	const setActiveShot = (i: number, img: string) => {
		activeShot = {i: i, src: img};
	};

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
	<div bind:offsetHeight={measureHeight} class="mh"></div>
	{/key}
	<div class="wrap" style={`--basis: ${wrapBasis}%`}>
		{#key item.id}
			<div
				class:transition={fadeOut}
				in:fade|global={{duration: 500, delay: 50}}
				out:fade|global={{duration: 300}}
				onoutrostart={() => {fadeOut = true}}
				onintroend={() => {fadeOut = false}}
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
				
				<textarea bind:value={md}></textarea>

				<SvelteMarkdown {md} />

				{#if item.images}
					<h4>Screenshots</h4>
					<ul>
						{#each item.images as _, i}
							<li>
								<Fullscreen 
									id={_.id}
									title={item.title}
									img={activeShot.src || _.large}
									targetImage={_.small}
									analyticsKey={`${analyticsKey} ${item.title}`}
									altText={`${item.title} screenshot ${(activeShot.i || i) + 1}`}
									paginationDetails={paginationDetails || {length: item.images.length, position: i}}
									paginateItem={paginateItem}
									onClose={resetFullScreen}
									onOpen={() => setActiveShot(i, _.large)}
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
	article {
		width: 66.66%
	} 
	.wrap {
		width: var(--basis);
		position: relative;
	}
	article {
		display: flex;
		justify-content: center;
		min-height: var(--min-height);
		padding: 1.3333rem 2rem 2rem ;
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
<script lang="ts">
	import { cleanUrlSlug } from "$lib/history";
	import { mqBreakPoint } from "$lib/spacing";
	import { captureBehavior, captureDetails } from "$lib/analytics";
	import { afterUpdate } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { fade } from "svelte/transition";
	import { clientNavigate } from "$lib/history";
	import Article from "./Article.svelte";
	import Nav from "./Nav.svelte";
	import type { Item } from "./types";
	
	export let item: Item;
	export let items; Array<Item>
	export let analyticsKey: string;
  export let parentRoute: string;

	let contentHeight: number;
	let measureHeight: number;
	let scrollRequestUpdate: boolean;

	let subnavHeight: number;

	let windowHeight: number;
  let windowWidth: number;
  let scrollY: number;

	let expanded = false;
	
	let scrollLogged = false;
	let isAbsolute: boolean;

	const checkIsAbsolute = () => {
		if (windowWidth > mqBreakPoint) return
		if(!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureHeight;
	};

	afterUpdate(checkIsAbsolute);
	afterNavigate(checkIsAbsolute);

  $: if(scrollY || windowWidth || contentHeight) checkIsAbsolute();

	const handleLinkClick = (_: Item) => {
		if (_.id == item.id) return;
		setItem(_.id);
		expanded = false;
		captureBehavior(`click ${analyticsKey}`, captureDetails({ id: _.id, name: _.title }));
		scrollLogged = false;
	}

	const setItem = (id: number) => (e: Event) => {
		e.preventDefault();
		item = items.data.filter(_ => _.id === id)[0];
		clientNavigate(true)(`/${parentRoute}/${item.id}`, item.title);
	}
</script>

<section class="w-sidebar" transition:fade={{duration: 300}} bind:clientHeight={contentHeight}>
	<Article 
		item={item} 
		subnavHeight={subnavHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		bind:measureHeight={measureHeight}

	/>
	<Nav
		activeTitle={item.title}
		contentHeight={contentHeight}
		measureHeight={measureHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		subnavHeight={subnavHeight}
	>
		{#each items as _ (_.id)}
			<li class:active={_.id === item.id}>
				<a 
					href={`/${parentRoute}/${_.id}/${cleanUrlSlug(_.title)}`}
					on:click={() => handleLinkClick(_)}
				>
					{_.title}
				</a>
			</li>
		{/each}
	</Nav>
</section>

<style>
	li {
		margin-bottom: 1rem;
		font-family: "josefin-bold";
	}
	a {
		color: var(--w-xl);
	}
	a:hover {
		color: var(--w-dk);
	}
	li.active a,	
	a:active {
		color: var(--y-md);
	}
	@media (max-width: 767.98px) {
		li {
			padding-left: 1.5rem;
		}
		li:first-of-type {
			padding-top: 1rem;
		}
		li:last-of-type {
			padding-bottom: 2rem;
		}
	}
</style>
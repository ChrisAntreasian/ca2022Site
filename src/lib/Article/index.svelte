<script lang="ts">
	import { mqBreakPoint } from "$lib/spacing";
	import { captureBehavior, captureDetails } from "$lib/analytics";
	import { afterUpdate } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { fade } from "svelte/transition";
	import { clientNavigate } from "$lib/history";
	import Article from "./Article.svelte";
	import Nav from "./Nav.svelte";
	import Item from "./Item.svelte"
	
	import type { Item as ItemT } from "./types";
	
	export let item: ItemT;
	export let items: ReadonlyArray<ItemT>;
	export let analyticsKey: string;
  export let parentRoute: string;
	export let defaultHeadline: string;
	export let wrapBasis = 100;

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

	const setItem = (id: number) => (e: Event) => {
		e.preventDefault();
		item = items.filter(_ => _.id === id)[0];
		clientNavigate(true)(`/${parentRoute}/${item.id}`, item.title);
	}

	const handleLinkClick = (_: ItemT) => {
		if (_.id == item.id) return;
		setItem(_.id);
		expanded = false;
		scrollLogged = false;
		captureBehavior(`click ${analyticsKey}`, captureDetails({ id: _.id, name: _.title }));
	}

</script>

<section class="w-sidebar" transition:fade={{duration: 300}} bind:clientHeight={contentHeight}>
	<Article 
		item={item} 
		subnavHeight={subnavHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		bind:measureHeight={measureHeight}
		analyticsKey={analyticsKey}
		wrapBasis={wrapBasis}
	/>
	<Nav
		activeTitle={item.title}
		contentHeight={contentHeight}
		measureHeight={measureHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		bind:subnavHeight={subnavHeight}
		bind:expanded={expanded}
		defaultHeadline={defaultHeadline}
	>
		{#each items as _ (_.id)}
			<Item 
				item={item} 
				currentItem={_} 
				parentRoute={parentRoute} 
				handleLinkClick={handleLinkClick}			
			/>
		{/each}
	</Nav>
</section>
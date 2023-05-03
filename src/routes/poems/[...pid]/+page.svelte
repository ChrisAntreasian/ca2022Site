<script lang="ts">
	import { fade } from "svelte/transition";
	import { clientNavigate } from "$lib/history";
	import Article from "../_modules/Article.svelte";
	import Nav from "../_modules/Nav.svelte";
	import type { PageServerData} from "./$types";
	
	export let data: PageServerData;
	export let measureH: number;

	let subnavHeight: number;
	let contentHeight: number;
	let scrollRequestUpdate: boolean = false;
	
	const setPoem = (id: number) => (e: Event) => {
		e.preventDefault();
		data.poem = data.poems.data.filter(_ => _.id === id)[0];
		clientNavigate(true)(`/poems/${data.poem.id}`, data.poem.attributes.title);
	}
</script>

<svelte:head>
	<title>Christopher Antreasian: Poems</title>
</svelte:head>

<section class="w-sidebar" transition:fade={{duration: 300}} bind:clientHeight={contentHeight}>
	<Article 
		poem={data.poem} 
		subnavHeight={subnavHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		bind:measureH={measureH}

	/>
	<Nav 
		poems={data.poems} 
		poem={data.poem} 
		setPoem={setPoem}
		contentHeight={contentHeight}
		measureH={measureH}
		bind:subnavHeight={subnavHeight}
		bind:scrollRequestUpdate={scrollRequestUpdate}
	/>
</section>

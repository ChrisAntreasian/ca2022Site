<script lang="ts">
	import { fade } from "svelte/transition";
	import { clientNavigate } from "$lib/history";
	import Article from "../_modules/Article.svelte";
	import Nav from "../_modules/Nav.svelte";
	import type { PageServerData} from "./$types";
	
	export let data: PageServerData;
	let subnavHeight: number;
	let contentHeight: number;
	const clientNavigateS = clientNavigate(true);
	
	const setPoem = (id: number) => (e: Event) => {
		e.preventDefault();
		data.poem = data.poems.data.filter(_ => _.id === id)[0];
		clientNavigateS(`/poems/${data.poem.id}`, data.poem.attributes.title);
	}
</script>

<svelte:head>
	<title>My Poems</title>
</svelte:head>

<section class="w-sidebar" transition:fade={{duration: 300}} bind:clientHeight={contentHeight}>
	<Article 
		poem={data.poem} 
		subnavHeight={subnavHeight}
	/>
	<Nav 
		poems={data.poems} 
		poem={data.poem} 
		setPoem={setPoem}
		contentHeight={contentHeight}
		bind:subnavHeight={subnavHeight}
	/>
</section>

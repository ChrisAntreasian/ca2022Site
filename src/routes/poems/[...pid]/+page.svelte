<script lang="ts">
	throw new Error("@migration task: Add data prop (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292707)");

	import { fade } from "svelte/transition";
	import type { Poem, StrapiPoem, WithId } from "$lib/types";
	import { clientNavigate } from "$lib/history";
	import Article from "../_modules/Article.svelte";
	import Nav from "../_modules/Nav.svelte";
	
	export let poems: StrapiPoem;
	export let poem: StrapiPoem["data"][number];

	const clientNavigateS = clientNavigate(true);
	const setPoem = (id: number) => (e: Event) => {
		e.preventDefault();
		poem = poems.data.filter(_ => _.id === id)[0];
		clientNavigateS(`/poems/${poem.id}`, poem.attributes.title);
	}
</script>

<svelte:head>
	<title>My Poems</title>
</svelte:head>

<section class="w-sidebar" transition:fade={{duration: 300}}>
	<Article poem={poem} />
	<Nav poems={poems} poem={poem} setPoem={setPoem} />
</section>
<script context="module" lang="ts">
	import type { Load } from "@sveltejs/kit";

	export const load: Load = async ({ params, fetch }) => {
		const res = await fetch("/poems.json");
		if (res.ok) {
			const pid = parseInt(params.pid) || 5;
			const poems = await res.json();
			const poem = poems.data.filter((_: WithId<Poem>) => _.id === pid)[0];
			return {
				props: { 
					poems,
					poem
				},

			};
		}
		const { message } = await res.json();
		return {
			error: new Error(message)
		};
	};
</script>

<script lang="ts">
	import { fade } from "svelte/transition";
	import type { Poem, StrapiPoem, WithId } from "$lib/types";
	import { clientNavigate } from "$lib/history";
	import Article from "./_modules/Article.svelte";
	import Nav from "./_modules/Nav.svelte";
	
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
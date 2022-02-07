<script context="module" lang="ts">
	import type { Load } from "@sveltejs/kit";
	export const load: Load = async ({ page, fetch, session, stuff }) => {
		const res = await fetch("/poems.json");
		const pid = parseInt(page.params.pid) || 5;
		if (res.ok) {
			const poems = await res.json();
			const poem = poems.data.filter(_ => _.id === pid)[0];
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
	import type { StrapiPoem } from "./../../lib/types";
	import { clientNavigate } from "./../../lib/history";
	import Article from "./_Article.svelte";
	import Nav from "./_Nav.svelte";
	
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

<section>
	<Article poem={poem.attributes} />
	<Nav poems={poems} poem={poem} setPoem={setPoem} />
</section>

<style>
	section {
		display: flex;
	}
</style>

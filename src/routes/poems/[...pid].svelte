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
	import type { Poem, StrapiPoem, Id } from "./../../lib/types";
	import { pushHistory, cleanUrlSlug } from "./../../lib/history";
	import PoemArticle from "./_PoemArticle.svelte";
	
	export let poems: StrapiPoem;
	export let poem: StrapiPoem["data"][number]
	
	const setId = (id: number) => (e: Event) => {
		e.preventDefault();
		poem = poems.data.filter(_ => _.id === id)[0];
		pushHistory(`/poems/${poem.id}`, poem.attributes.title);
	}

</script>

<svelte:head>
	<title>My Poems</title>
</svelte:head>

<section>
	<PoemArticle poem={poem.attributes} />

	<nav>
		<h2> Poetry post sanity</h2>
		<ul>
			{#each poems.data as _ (_.id)}
				<li>
					<a 
						on:click={setId(_.id)} 
						href={`/poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`} 
						class={_.id === poem.id ? "active" : ""}
					>
						{_.attributes.title}
					</a>
				</li>
			{/each}			
		</ul>
	</nav>
</section>

<style>
	section {
		display: flex;
	}
	nav {
		background: var(--lt-y);
		flex-grow: 1;
		color: var(--off-bk);
		padding: 1rem;
		border: 0.25rem solid var(--md-p);
		border-top-right-radius: var(--corner);
		border-bottom-right-radius: var(--corner);
		box-shadow: inset 0.5rem 0 0.75rem var(--md-y)
	}
	ul {
		list-style: none;
		line-height: 2rem;
		padding: 0;
		font-weight: 600;
		letter-spacing: 0.02rem;
	}
</style>

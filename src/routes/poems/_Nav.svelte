

<script lang="ts">
  import type { StrapiPoem} from "../../lib/types";
	import { cleanUrlSlug } from "./../../lib/history";

	export let poems: StrapiPoem;
	export let poem: StrapiPoem["data"][number];
	export let setPoem: (_: number) => (e: Event) => void;
	// Poems post-sanity
</script>

<nav>
	<h2>Writing Lighting </h2>
	<ul>
		{#each poems.data as _ (_.id)}
			<li>
				<a 
					on:click={setPoem(_.id)} 
					href={`/poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`} 
					class={_.id === poem.id ? "active" : ""}
				>
					{_.attributes.title}
				</a>
			</li>
		{/each}			
	</ul>
</nav>

<style>
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
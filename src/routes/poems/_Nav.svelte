

<script lang="ts">
  import type { StrapiPoem} from "../../lib/types";
	import { cleanUrlSlug } from "./../../lib/history";

	export let poems: StrapiPoem;
	export let poem: StrapiPoem["data"][number];
	export let setPoem: (_: number) => (e: Event) => void;
	// Poems post-sanity
	// Writing Lighting
</script>

<nav>
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
		background: var(--p-md);
		flex-grow: 1;
		color: var(--off-bk);
		border-left: var(--space-md) solid var(--b-dk);
	}
	/* h2 {
		color: var(--w-lt);
	} */
	a {
		color: var(--w-xl);
	}
	a:hover {
		color: var(--w-dk);
	}
	a:active {
		color: var(--b-lt)
	}
	a.active {
		color: var(--y-md);
	}
	ul {
		list-style: none;
		line-height: 2rem;
		padding: 1rem 2rem 2rem;
		font-weight: 600;
		letter-spacing: 0.01rem;
		background-image: linear-gradient(var(--p-dk), var(--p-md));

	}
</style>
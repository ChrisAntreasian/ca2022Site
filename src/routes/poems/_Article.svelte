

<script lang="ts">
  import SvelteMarkdown from 'svelte-markdown'
  import type { Poem} from "../../lib/types";
	export let poem: Poem;

</script>

<article>
	<div>
		<h3>{poem.title}</h3>
		<SvelteMarkdown source={poem.body} />
	</div>
</article>

<style>
	article {
		padding: 2rem 0;
		border-left: var(--border-md);
		width: 75%;
		display: flex;
		justify-content: center;
	}
	div {
		width: 66%
	}
</style>
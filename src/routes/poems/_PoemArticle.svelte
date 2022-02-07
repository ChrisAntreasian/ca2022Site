

<script lang="ts">
  import SvelteMarkdown from 'svelte-markdown'
  import type { Poem} from "../../lib/types";
	export let poem: Poem;

</script>

<article>
	<h3>{poem.title}</h3>
	<SvelteMarkdown source={poem.body} />
</article>

<style>
	article {
		width: 75%;
    border: 0.25rem solid var(--md-p);
		padding: 1rem;
		background-color: white;
    border-top-left-radius: var(--corner);
		border-bottom-left-radius: var(--corner);
		filter: drop-shadow(var(--outershadow));
		box-shadow: inset 0 0 1rem #f3f3f3;
	}
</style>
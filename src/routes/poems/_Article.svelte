

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
    border-top-left-radius: var(--corner);
		border-bottom-left-radius: var(--corner);
	}
</style>
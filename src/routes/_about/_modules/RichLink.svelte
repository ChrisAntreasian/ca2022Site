	
<script lang="ts">
	import type { RichLink, WithId } from "$lib/types"; 

	export let richLinks: Array<WithId<RichLink>>;
</script>

<section class="home">
	{#each richLinks as rl}
  <a href={rl.attributes.link}> 
		<h4>{rl.attributes.title.split(":")[0]}: </h4>
		{#if rl.attributes.image}
			<img 
				src={`${rl.attributes.image.data.attributes.formats 
					? rl.attributes.image.data.attributes.formats.small.url 
					:rl.attributes.image.data.attributes.url}`}
				alt={rl.attributes.image.data.attributes.alternativeText} />
		{/if}
		<p>{rl.attributes.body}</p>
	
		</a>
		{/each}
	</section>
	<style>
		img {
			max-width: 15rem;
		}
		a {
			width: 50%;
			padding: 1.5rem;
		}
	</style>


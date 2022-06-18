<script lang="ts">
  import { cleanUrlSlug } from "$lib/history";
	import { apiBaseUrl } from "$lib/api";	
  import type { StrapiPageDetails } from "$lib/types";

	export let links: StrapiPageDetails;
</script>

<section class="home">
  {#each links as ni}
		{#if ni.attributes.title === "My poetry"}
			<a href={ni.attributes.link}>
				<div>
					<h4>{ni.attributes.title}</h4>
					<p>{ni.attributes.description}</p>
				</div>
				<ul>
					{#each ni.attributes.poems.data as _}
						<li>
							<a href={`poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`}>
								{_.attributes.title}
							</a>
						</li>
					{/each}
				</ul>
			</a>
		{/if}
		{#if ni.attributes.title === "The Quintuplapus"}
			<a href={ni.attributes.link}>
				<div>
					<h4>{ni.attributes.title}</h4>
					<p>{ni.attributes.description}</p>
				</div>
				{#if ni.attributes.art_piece}
					<img 
						src={`${apiBaseUrl}${ni.attributes.art_piece.data.attributes.image.data.attributes.formats
							? ni.attributes.art_piece.data.attributes.image.data.attributes.formats.small.url
							: ni.attributes.art_piece.data.attributes.image.data.attributes.url
						}`} 
						alt={ni.attributes.art_piece.data.attributes.title} 
					/>
			{/if}
			</a>
		{/if}
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
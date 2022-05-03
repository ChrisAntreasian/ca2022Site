<script context="module" lang="ts">

import type { Load } from '@sveltejs/kit';
import type { StrapiPage, Art, StrapiPageDetails, StrapiData, RichLink } from "$lib/types";

	
	export const prerender = true;


	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/json');
		if (res.ok) {
			const introIds = [3, 4];
			const resp: StrapiPage = await res.json();
			const attrs = resp.data[0].attributes;
			
			console.log(resp)
			
			return {
				props: { 
					richLinks: attrs.rich_links.data,
					...attrs.page_details.data.reduce((
						acc: { intro: StrapiPageDetails, links: StrapiPageDetails, }, 
						d: StrapiPageDetails[0]
					) => {
						if (introIds.includes(d.id)) {
							acc.intro.push(d)
						}
						acc.intro.push(d)
						return acc;
					}, { intro: [], links: [] })
				},
			};
		}
	}
</script>

<script lang="ts">
	// export let intro: StrapiPageDetails;
	// export let links: StrapiPageDetails;
	// export let richLinks: StrapiData<RichLink>["data"]
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<section class="intro">
	<figure>

	</figure>
</section>

<section>
	
</section>
<section class="affiliates">

</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 1;
	}

</style>

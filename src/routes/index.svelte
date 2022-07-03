<script context="module" lang="ts">

	import type { Load } from '@sveltejs/kit';
	import type { StrapiPage, StrapiPageDetails, ImageData } from "$lib/types";

	export const prerender = true;
	
	const introIds = [5, 3, 4];

	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/json');
		if (res.ok) {
			const resp: StrapiPage = await res.json();
			const attrs = resp.data[0].attributes;		
			const props: {
				props: {
					intro: StrapiPageDetails,
					links: StrapiPageDetails,
				}
			} = {
				props: { 
					...attrs.page_details.data.reduce((
						acc: { 
							intro: StrapiPageDetails, 
							links: StrapiPageDetails, 
						}, 
						d: StrapiPageDetails[0]
					) => {
						if (introIds.includes(d.id)) {
							acc.intro.push(d);
						} else {
							acc.links.push(d)
						}
						return acc;
					}, { 
						intro: [], 
						links: [] 
					})
				},
			};
			return props;
		}
	}
</script>

<script lang="ts">
  import Intro from "./_modules/Intro.svelte";
	import Nav from "./_modules/Nav.svelte"

	export let intro: StrapiPageDetails;
	export let links: StrapiPageDetails;
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<section class="w-sidebar">
	<Intro intro={intro} />
	<Nav links={links} />
</section>


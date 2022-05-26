<script context="module" lang="ts">

	import type { Load } from '@sveltejs/kit';
	import type { StrapiPage, StrapiPageDetails, RichLink, WithId, ImageData, IntroDetails } from "$lib/types";
	import { apiBaseUrl } from "$lib/api";	

	export const prerender = true;
	
	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/json');
		if (res.ok) {
			const introIds = [5, 3, 4];
			const resp: StrapiPage = await res.json();
			const attrs = resp.data[0].attributes;		
			const props: {
				props: {
					richLinks: Array<WithId<RichLink>>,
					intro: IntroDetails,
					links: StrapiPageDetails,
				}
			} = {
				props: { 
					richLinks: attrs.rich_links.data,
					...attrs.page_details.data.reduce((
						acc: { 
							intro: IntroDetails, 
							links: StrapiPageDetails, 
						}, 
						d: StrapiPageDetails[0]
					) => {
						console.log(d.attributes)
						if (d.id === 5) {
							acc.intro.image = d.attributes.image;
						}
						if (introIds.includes(d.id)) {
							acc.intro.details.push(d);
						} else {
							acc.links.push(d)
						}
						return acc;
					}, { 
						intro: {
							details: [],
							image: {} as ImageData
						}, 
						links: [] 
					})
				},
			};
			return props;
		}
	}
</script>

<script lang="ts">
	import { cleanUrlSlug } from "$lib/history";
  import RL from "./_modules/RichLink.svelte";
  import Intro from "./_modules/Intro.svelte";
	import Links from "./_modules/Links.svelte"

	export let intro: IntroDetails;
	export let links: StrapiPageDetails;
	export let richLinks: Array<WithId<RichLink>>;
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

	<Intro intro={intro} />
	<Links links={links} />
	<RL richLinks={richLinks} />


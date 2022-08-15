<script context="module" lang="ts">

	import type { Load } from '@sveltejs/kit';
	import type { StrapiPage, StrapiPageDetails, RichLink, WithId, Art } from "$lib/types";
	
	export const load: Load = async ({ params, fetch, session, stuff }) => {
		const res = await fetch('/about.json');
		if (res.ok) {
			
			const resp: StrapiPage = await res.json();
			
			const attrs = resp.data[0].attributes;		
			console.log(attrs.art_pieces)
			const props = {
				props: { 
					images: attrs.art_pieces.data,
					richLinks: attrs.rich_links.data,
					intro: attrs.page_details.data
				},
			};
			return props;
		}
	}
</script>

<script lang="ts">
  import RL from "./_modules/RichLink.svelte";
  import Intro from "./_modules/Intro.svelte";
	export let intro: StrapiPageDetails;
	export let images: Array<WithId<Art>>;
	export let richLinks: Array<WithId<RichLink>>;
</script>

<svelte:head>
	<title>About</title>
</svelte:head>

<Intro intro={intro} images={images}/>
<RL richLinks={richLinks} />


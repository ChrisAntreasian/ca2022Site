<script lang="ts">
	import Article from "$lib/Article/index.svelte"
	import type { PageServerData} from "./$types";
	
	interface Props {
		data: PageServerData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Christopher Antreasian: Poems</title>
</svelte:head>

<Article 
	item={data.item} 
	items={data.items}
	analyticsKey="poem"
	parentRoute="poems"
	defaultHeadline="poetry"
	wrapBasis={70}
/>

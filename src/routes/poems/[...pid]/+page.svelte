<script lang="ts">
	import Article from "$lib/Article/index.svelte"
	import type { PageServerData} from "./$types";
	
	export let data: PageServerData;
</script>

<svelte:head>
	<title>Christopher Antreasian: Poems</title>
</svelte:head>

<Article 
	item={data.item} 
	items={data.items}
	analyticsKey="poem"
	parentRoute="poems"
/>

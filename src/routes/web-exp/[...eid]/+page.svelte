<script lang="ts">
	import Article from "$lib/Article/index.svelte"
	// import type { PageServerData} from "./$types";
	
	// export let data: PageServerData;
  let data = {
    item: {title: "", body: "", id: 0},
    items: [],
  }
</script>

<svelte:head>
	<title>Christopher Antreasian: Web Development Experience</title>
</svelte:head>

<Article 
	item={data.item} 
	items={data.items}
	analyticsKey="web"
	parentRoute="web-exp"
/>

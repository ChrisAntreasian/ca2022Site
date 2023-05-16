<script lang="ts">
	import Article from "$lib/Article/index.svelte"
	import type { PageServerData} from "./$types";
	export let data: PageServerData;

</script>

<svelte:head>
	<title>Christopher Antreasian: Web Development Experience</title>
</svelte:head>

<Article 
	item={data.item} 
	items={data.items}
	analyticsKey="web"
	parentRoute="web-experience"
	defaultHeadline="Web Experience"
>
	<a class="sidebar-link" href="/CA-Resume-2023.pdf" target="_blanks" download="CA-Resume.pdf">
		&#9660; Download Resume
	</a>
</Article>
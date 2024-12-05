<script lang="ts">
	import Article from "$lib/Article/index.svelte"
	import type { PageServerData} from "./$types";
	interface Props {
		data: PageServerData;
	}

	let { data }: Props = $props();

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

<style>
@media (max-width: 767.98px) { 
	a {
		display: block;
		padding: 0 2rem;
	}
}
</style>
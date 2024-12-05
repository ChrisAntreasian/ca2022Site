<script lang="ts">
	import type { PageServerData } from "./$types";
	
	import Gallary from "$lib/Gallary/index.svelte";
	interface Props {
		data: PageServerData;
	}

	let { data }: Props = $props(); 	
	let parentRoute = "/the-quintuplapus/";
	let analyticsKey = "the Quintuplapus";
</script>

<svelte:head>
	<title>The Quintuplapus</title>
</svelte:head>

<Gallary 
	artPieces={data.artPieces}
	artPiece={data.artPiece}
	categoryTitle={data.categoryTitle}
	parentRoute={parentRoute} 
	analyticsKey={analyticsKey}
	useUrlTitle={true}
/>

<script lang="ts">
	import type { PageServerData } from "./$types";
	
	export let data: PageServerData;  
	import Gallary from "$lib/Gallary/index.svelte"; 	
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

<script lang="ts">
	import type { PageServerData } from "./$types";
	
	export let data: PageServerData;  
	import Gallary from "$lib/Gallary/index.svelte"; 	
	
	let parentRoute = "/the-souljuicer/";
	let analyticsKey = "the SoulJuicer";
</script>

<svelte:head>
	<title>The SoulJuicer</title>
</svelte:head>

<Gallary 
	artPieces={data.artPieces}
	artPiece={data.artPiece}
	categoryTitle={"The SoulJuicer"}
	parentRoute={parentRoute} 
	analyticsKey={analyticsKey}
	hideMobileTitle={true}
/>

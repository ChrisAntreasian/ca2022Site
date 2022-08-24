<script lang="ts">

	import { s3Bucket } from '$lib/api';
	import { safeImageString } from "$lib/image";	
  import { getContext } from "svelte";
	import { contextHeightKey, rem } from "$lib/spacing";
	import Nav from "./_modules/Nav.svelte"
	import type { PageServerData} from "./$types";

	export let data: PageServerData;  

	const { getHeaderHeight, getFooterHeight } = getContext(contextHeightKey);
  let windowHeight: number;
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<svelte:window bind:innerHeight={windowHeight} />
<section class="w-sidebar">
	{#each data.intro as sec}<div class="m-only m-headline"><h2>{sec.attributes.title}</h2></div>{/each}

	<article class="home" style={`--min-height: ${(windowHeight - getHeaderHeight() - getFooterHeight()) / rem}rem`}>
		{#each data.intro as sec}
			<div class="intro-segment">
				<div>
					<h2 class="d-only">{sec.attributes.title}</h2>
					<p>{sec.attributes.description}</p>
				</div>
				{#if sec.attributes.image}
					<img 
						src={`${s3Bucket}${safeImageString("original")(sec.attributes.image)}`} 
						alt={sec.attributes.title} 
					/>
				{/if}
			</div>
		{/each}
		</article>

		<aside class="bnav bnav-aside">
			<Nav links={data.links} />
		</aside>
</section>

<style>
	h2 {
		color: var(--b-md);
		margin-top: 2.5rem;
		font-size: 2.5rem;
	}
  article {
    flex-basis: 50%;
    min-height: var(--min-height);
    padding: 0rem 1rem 1rem;
    margin-top: 0;
		justify-content: space-between;
  }

  .intro-segment{
		height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
	}
  img {
    width: 100%;
    justify-self: flex-end;
  }
	aside {
		flex-basis: 50%;
		flex-shrink: 0;
	}
	@media (max-width: 767.98px) {
		section {
			align-items: center;
		}
		.m-headline {
			width:100%;
			background: linear-gradient( 180deg, var(--b-dk) 30%, var(--bg-dk) 85% );
		}
		.m-headline h2 {
			color: var(--w-xl);
			text-align: center;
			font-size: 4rem;
		}
		h2 {
			padding-bottom: 0.5rem;
			padding-left: 1rem;
			font-size: 2.5rem;
			text-align: left;
			order: 1;
			margin-bottom: 1rem;
		}
		article {
			padding: 1rem 2rem;
			min-height: auto;
			order: 3;
		}
		aside {
			order: 2;
			padding: 0.5rem 0;
			border-bottom: var(--space-md) solid var(--y-md);
		}
	}
</style>
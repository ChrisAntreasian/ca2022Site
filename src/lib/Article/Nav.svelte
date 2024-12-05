<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
	import Arrow from "$lib/arrow/Arrow.svelte";
	import { mqBreakPoint, toRem } from "$lib/spacing";
	import { captureBehavior } from "$lib/analytics";
	import { afterUpdate } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { noScroll } from "$lib/body";
	import { fade } from "svelte/transition";

	export let activeTitle: string;
  export let contentHeight: number;
	export let measureHeight: number;
	export let scrollRequestUpdate: boolean;
	export let defaultHeadline: string;

	export let subnavHeight: number;
	export let expanded;

	let windowHeight: number;
  let windowWidth: number;
  let scrollY: number;

	let scrollLogged = false;
	let isAbsolute: boolean;

	const checkIsAbsolute = () => {
		if (windowWidth > mqBreakPoint) return
		if(!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureHeight;
	};

	afterUpdate(checkIsAbsolute);
	afterNavigate(checkIsAbsolute);

	$: navHeight = windowHeight * 0.72;
  $: if(scrollY || windowWidth || contentHeight) checkIsAbsolute();

	const handleMNavHandle = () => {
    expanded = !expanded
    captureBehavior("click expand mobile nav", {expanded: expanded});
		scrollLogged = false;
  }

	const scrollMNav = () => {
    if (!scrollLogged) {
      captureBehavior("scroll mobile nav");
      scrollLogged = true;
    }
  }
</script>
	
<svelte:window 
  bind:innerHeight={windowHeight} 
  bind:innerWidth={windowWidth}
  bind:scrollY={scrollY}
/>

<svelte:body use:noScroll={expanded} />

{#if expanded}
	<div class="bg-overlay"
		on:click={handleMNavHandle}
		on:keypress={handleMNavHandle}
		transition:fade|global={{duration: 200}} 
	/>
{/if}

<nav class="bnav bnav-aside subnav"
	class:absolute={isAbsolute}
	bind:clientHeight={subnavHeight} 
>
	<div class="subnav-wrap">
		<div class="subnav-handle" 
			on:click={handleMNavHandle}
			on:keypress={handleMNavHandle}
		>
			<h3>{expanded ? defaultHeadline : activeTitle}</h3>
			<div class="subnav-action">
				<Arrow direction={expanded ? "bottom": "top"} color="white" size="medium" />
			</div>
		</div>
		<div class="subnav-content">
			<ul on:scroll={scrollMNav} class:expanded={expanded} style="--nav-height: {toRem(navHeight)}rem">
				<slot />
			</ul>
		</div>
	</div>
</nav>

<style>
	ul {
		line-height: 2rem;
		letter-spacing: 0.01rem;
		padding: 1rem 2rem 2rem;
	}
	.bg-overlay {
		display: none;
	}
	@media (max-width: 767.98px) { 
		nav {
			z-index: 50;
		}
		.subnav-handle {
			height: var(--header-height);
			width: 100%;
			display: flex;
			justify-content: space-between;
		}
		.subnav.absolute {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }
		ul {
			padding: 0;
		}
		.bg-overlay {
			display: block;
		}
	}
</style>
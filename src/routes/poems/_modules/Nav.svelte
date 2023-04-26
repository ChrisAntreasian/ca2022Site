<script lang="ts">
	import Arrow from "$lib/arrow/Arrow.svelte";
	import type { IO } from "fp-ts/IO";
  import type { Poem, StrapiPoem, WithId} from "$lib/types";
	import { cleanUrlSlug } from "$lib/history";
	import { mqBreakPoint, toRem } from "$lib/spacing";
	import { captureBehavior, captureDetails } from "$lib/analytics";
	import { afterUpdate } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { noScroll } from "$lib/body";
	import { fade } from "svelte/transition";

	export let poems; Array<WithId<Poem>>
	export let poem: WithId<Poem>;
	export let setPoem: (id: number) => (fa: IO<Event>) => IO<void>;
  export let contentHeight: number;
	export let measureH: number;
	export let scrollRequestUpdate: boolean;

	export let subnavHeight: number;
	
	let windowHeight: number;
  let windowWidth: number;
  let scrollY: number;

	let expanded = false;
	
	let scrollLogged = false;
	let isAbsolute: boolean;

	const checkIsAbsolute = () => {
		if (windowWidth > mqBreakPoint) return
		if(!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureH;
	};

	afterUpdate(checkIsAbsolute);
	afterNavigate(checkIsAbsolute);

	$: navHeight = windowHeight * 0.72;
  $: if(scrollY || windowWidth || contentHeight) checkIsAbsolute();

	const handleLinkClick = (_: StrapiPoem["data"][number]) => {
		if (_.id == poem.id) return;
		setPoem(_.id);
		expanded = false;
		captureBehavior("click poem", captureDetails({ id: _.id, name: _.attributes.title }));
		scrollLogged = false;
	}

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
		transition:fade={{duration: 200}} 
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
			<h3>{expanded ? "poetry" : poem.attributes.title}</h3>
			<div class="subnav-action">
				<Arrow direction={expanded ? "bottom": "top"} color="white" size="medium" />
			</div>
		</div>
		<div class="subnav-content">

			<ul on:scroll={scrollMNav} class:expanded={expanded} style="--nav-height: {toRem(navHeight)}rem">
				{#each poems.data as _ (_.id)}
					<li class:active={_.id === poem.id}>
						<a 
							href={`/poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`}
							on:click={() => handleLinkClick(_)}
						>
							{_.attributes.title}
						</a>
					</li>
				{/each}			
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
	li {
		margin-bottom: 1rem;
		font-family: "josefin-bold";
	}
	a {
		color: var(--w-xl);
	}
	a:hover {
		color: var(--w-dk);
	}
	li.active a,	
	a:active {
		color: var(--y-md);
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
		li {
			padding-left: 1.5rem;
		}
		li:first-of-type {
			padding-top: 1rem;
		}
		li:last-of-type {
			padding-bottom: 2rem;
		}
		.bg-overlay {
			display: block;
		}
	}
</style>
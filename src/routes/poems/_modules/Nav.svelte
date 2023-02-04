

<script lang="ts">
	import Arrow from "$lib/arrow/Arrow.svelte";

  import type { StrapiPoem} from "$lib/types";
	import { cleanUrlSlug } from "$lib/history";
	import { contextHeightKey, fromRem, mqBreakPoint, toRem, type LayoutElemH } from "$lib/spacing";
	import { captureBehavior, captureDetails } from "$lib/analytics";
	import { afterUpdate, getContext } from "svelte";
	import { afterNavigate } from "$app/navigation";

	export let poems;
	export let poem;
	export let setPoem: (_: number) => (e: Event) => void;
	export let subnavHeight: number;
  export let contentHeight: number;
	
	let windowHeight: number;
  let windowWidth: number;
  let scrollY: number;

	let expanded = false;
	let subnavWidth: number;
	
	let scrollLogged = false;
	let isAbsolute: boolean;

	const checkIsAbsolute = () => {
		if (windowWidth > mqBreakPoint) return
		console.log("checkIsAbsolute", {
      s: scrollY, 
      snh: subnavHeight,
      wh: windowHeight,
      ch: contentHeight
    });
		isAbsolute =  windowHeight + scrollY - subnavHeight > contentHeight;
	};

	afterUpdate(checkIsAbsolute);
	afterNavigate(checkIsAbsolute);

	$: navHeight = windowHeight * 0.72;
  $: if(scrollY || windowWidth || contentHeight) checkIsAbsolute();

	// const { getHeaderHeight }: LayoutElemH = getContext(contextHeightKey);

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
<nav class="bnav bnav-aside subnav"
	class:absolute={isAbsolute}
	bind:clientWidth={subnavWidth} 
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
	@media (max-width: 767.98px) { 
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
	}
</style>
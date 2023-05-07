<script lang="ts">

  import type { Poem, StrapiPoem, WithId} from "$lib/types";
	import { cleanUrlSlug } from "$lib/history";
	import { mqBreakPoint } from "$lib/spacing";
	import { captureBehavior, captureDetails } from "$lib/analytics";
	import { afterUpdate } from "svelte";
	import { afterNavigate } from "$app/navigation";

	import Nav from "$lib/Article/Nav.svelte"

	export let poems; Array<WithId<Poem>>
	export let poem: WithId<Poem>;
	export let setPoem: (_: number) => (e: Event) => void;
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

  $: if(scrollY || windowWidth || contentHeight) checkIsAbsolute();

	const handleLinkClick = (_: StrapiPoem["data"][number]) => {
		if (_.id == poem.id) return;
		setPoem(_.id);
		expanded = false;
		captureBehavior("click poem", captureDetails({ id: _.id, name: _.attributes.title }));
		scrollLogged = false;
	}

</script>

<Nav
	activeTitle={poem.attributes.title}
	contentHeight={contentHeight}
	measureH={measureH}
	scrollRequestUpdate={scrollRequestUpdate}
	subnavHeight={subnavHeight}
>
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
</Nav>

<style>
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
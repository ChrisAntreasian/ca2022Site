

<script lang="ts">
	import { fade } from "svelte/transition";
	import Arrow from "$lib/arrow/Arrow.svelte";

  import type { StrapiPoem} from "../../lib/types";
	import { cleanUrlSlug } from "./../../lib/history";

	export let poems: StrapiPoem;
	export let poem: StrapiPoem["data"][number];
	export let setPoem: (_: number) => (e: Event) => void;
	let expanded = false;
	let windowHeight;
	$: navHeight = windowHeight * 0.666;
</script>
	
<svelte:window bind:innerHeight={windowHeight} />

<nav>
	<div class="wrap">
		<div class="nav-handle" on:click={() => { expanded = !expanded }}>
			<h3>{poem.attributes.title}</h3>
			<div class="arrow">
				<Arrow direction={expanded ? "bottom": "top"} color="white" size="medium" />
			</div>
		</div>
		<ul class:expanded={expanded} style="--nav-height: {navHeight}px">
			{#each poems.data as _ (_.id)}
				<li class:active={_.id === poem.id}>
					<a 
						on:click={() => {
							if (_.id == poem.id) return;

							setPoem(_.id);
							expanded = false;
						}} 
						href={`/poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`}
					>
						{_.attributes.title}
					</a>
				</li>
			{/each}			
		</ul>
	</div>
</nav>

<style>
	nav {
		background: var(--p-md);
		flex-grow: 1;
		color: var(--off-bk);
		border-left: var(--space-md) solid var(--b-dk);
	}
.wrap {
	background-image: linear-gradient(var(--p-dk), var(--p-md));
}	
	ul {
		list-style: none;
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
	.nav-handle  {
		display: none;
	}
	@media (max-width: 767.98px) { 
		nav {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			border-left: none;
			border-top: var(--space-md) solid var(--b-dk);
			cursor: pointer;
		}
		.nav-handle {
			height: var(--header-height);
			width: 100%;
			display: flex;
			justify-content: space-between;
		}
		h3 {
			display: block;
			line-height: var(--header-height);
			color: var(--w-xl);
			font-size: 1.666rem;
			padding-left: 1.5rem;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.arrow {
			padding-right: 1.5rem;
		}
		ul {
			height: 0;
			padding: 0;
			overflow: hidden;
			transition: height 0.33s ease-in-out;
		}
		ul.expanded {
			height: var(--nav-height);
			overflow: scroll;
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
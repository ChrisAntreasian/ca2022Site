
<script lang="ts">
	import { s3Bucket } from '$lib/api';

	import type { StrapiImageData } from "$lib/types";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
	import { fade } from "svelte/transition";
	import { mqBreakPoint } from "$lib/spacing";
	import 'hamburgers/dist/hamburgers.css';
	import { safeImageString } from '$lib/image';
	
	export let logo: StrapiImageData;
	export let title: string;
	export let headerHeight: number;

	let toggleMenuActive = false;
	const resetMenu = () => { toggleMenuActive = false }

	let windowWidth: number;

	const nameWidth = tweened(0, {
		easing: cubicOut,
    duration: 1200,
  });

	const showName = () => { nameWidth.set(windowWidth > mqBreakPoint ? 20 : 18) };

	const defaultHWidth = () => windowWidth > mqBreakPoint ? 0 : 18
	const hideName = () => { nameWidth.set(defaultHWidth()) };
	
	onMount(() => { nameWidth.set(defaultHWidth()) })

</script>

<svelte:window bind:innerWidth={windowWidth} />

<header bind:clientHeight={headerHeight}>
	<div class="header-bg"></div>
	<div class="header-wrap">
		<div class="header-title" style={`width: ${$nameWidth}rem;`}>
			<h1>{title}</h1>
		</div>
		<figure on:focus={showName} on:mouseover={showName} on:blur={hideName} on:mouseout={hideName}>
			<img 
				src={`${s3Bucket}${safeImageString("thumbnail")(logo)}`} 
				alt={title} 
			/>
		</figure>
		<nav class:is-active={toggleMenuActive}>
			{#if toggleMenuActive}
				<div 
					class="bg-overlay" 
					on:click={resetMenu}
					transition:fade={{duration: 200}} 
				/>
			{/if}
			<ul>
				<li class:active={$page.url.pathname === '/'}>
					<a on:click={resetMenu} sveltekit:prefetch href="/">Home</a>
				</li>
				<li class:active={$page.url.pathname === 'illustration'}>
					<a on:click={resetMenu} sveltekit:prefetch href="/illustration">Illustration</a>
				</li>
				<li class:active={$page.url.pathname === '/poems'}>
					<a on:click={resetMenu} sveltekit:prefetch href="/poems">Poems</a>
				</li>
			</ul>
		</nav>
	</div>
	<button on:click={() => {toggleMenuActive = !toggleMenuActive}} class="hamburger hamburger--spring" class:is-active={toggleMenuActive} type="button">
		<span class="hamburger-box">
			<span class="hamburger-inner"></span>
		</span>
	</button> 
</header>

<style>
	figure {
		height: 4rem;
		width: 4rem;
		position: absolute;
		left: 0;
		margin-left: -2rem;
		margin-top: 0.5rem;
		overflow: hidden;
		cursor: pointer;
		background: var(--b-lt);
		border: 0.33rem solid var(--b-md);
		border-radius: 50%;
	}
	img {
		height: 4rem;
		position: absolute;
	}
	header {
		width: 100%;
		height: var(--header-height);
		display: flex;
		flex-grow: 1;
		justify-content: space-around;
		position: fixed;
		top: 0;
		z-index: 100;
	}
	.header-bg {
		width: 100%;
		height: var(--header-height);
		max-width: none;
		position: absolute;
		border-bottom: var(--space-md) solid var(--p-dk);
		background-image: linear-gradient(var(--o-md) 75%, var(--o-dk));
	}
	h1 {
		font-size: 1.5rem;
		line-height: var(--header-height);
		white-space: nowrap;
	}
	
	nav {
		display: flex;
		justify-content: center;
	}
	ul {
		height: var(--header-height);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0;
		margin: 0;
		list-style: none;
		background: var(--background);
		background-size: contain;
	}

	li {
		position: relative;
		height: 100%;
	}
	
	nav a {
		height: 100%;
		display: flex;
		align-items: center;
		padding: 0 1rem;
		letter-spacing: 0.1em;
		text-decoration: none;
		font-family: var(--font-th);
		font-size: 1.33rem;
		color: var(--b-dk);
		transition: transform 0.33s;

	}
	nav a:hover {
		transform: scale(1.15);
		color: var(--b-md);

	}

	.header-wrap {
		width: 100%;
		max-width: var(--wrapper-width);
		display: flex;
		justify-content: flex-end;
		position: relative;
	}
	.header-title {
		height: 4rem;
		width: 4rem;
		position: absolute;
		left: 0;
		overflow: hidden;
	}
	.hamburger {
		padding: 0.333rem 1rem 0 0;
		display: none;
	}
	.hamburger-inner {
		transition: none;
	}
	.hamburger-inner,
	.hamburger-inner::before, 
	.hamburger-inner::after {
		background-color: var(--b-dk);
		
	}
	.hamburger:hover .hamburger-inner,
	.hamburger:hover .hamburger-inner::before,
	.hamburger:hover .hamburger-inner::after {
		background-color: var(--b-md);
	}

	@media (max-width: 767.98px) { 
		.hamburger {
			display: block;
			z-index: 120;
		}
		.hamburger:hover,
		.hamburger.is-active {
			opacity: 1;
		}
		.header-bg {
			z-index: 115;
		}
		figure,
		.header-title {
			z-index: 120;
		}
		h1 {
			font-size: 1.2rem;
		}
		ul {
			height: 100%;
			width: 33.333%;
			flex-direction: column;
			align-items: flex-start;
			justify-content: flex-start;
			position: fixed;
			right: 0;
			z-index: 110;
			margin-right: calc(-33.333% + -3rem);
			padding: calc(var(--header-height) + 2rem + var(--space-md)) 2rem 0 1rem;
			border-left: var(--space-md) solid var(--p-dk);
			transition: margin-right 0.5s ease-in-out;
			background-image: linear-gradient(var(--o-dk), var(--o-md) 20%);
		}
		.is-active ul {
			margin-right: 0;
		}

		li {
			height: auto;
		}
		li a {
			padding: 1rem 0;
		}
	}
</style>

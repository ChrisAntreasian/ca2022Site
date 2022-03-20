
<script lang="ts">
	import type { Art } from "./types";
	import { page } from '$app/stores';
	import { apiBaseUrl } from "./api";	
	import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let art: Art;
	export let headerHeight: number;

	const nameWidth = tweened(0, {
		easing: cubicOut,
    duration: 1200,
  });
	
	const showName = () => {
		nameWidth.set(24);
	};
	const hideName = () => {
		nameWidth.set(0);
	};

</script>

<header bind:clientHeight={headerHeight}>
	<div>
		<div style={`width: ${$nameWidth}rem;`}>
			<h1>Christopher Antreasian</h1>
		</div>
		<figure on:focus={showName} on:mouseover={showName} on:blur={hideName} on:mouseout={hideName}>
			<img 
				src={`${apiBaseUrl}${art.image.data.attributes.formats.thumbnail.url}`} 
				alt={art.description} 
			/>
		</figure>
		<nav>
			<ul>
				<li class:active={$page.url.pathname === '/'}>
					<a sveltekit:prefetch href="/">Home</a>
				</li>
				<li class:active={$page.url.pathname === 'illustration'}>
					<a sveltekit:prefetch href="/illustration">Illustration</a>
				</li>
				<li class:active={$page.url.pathname === '/poems'}>
					<a sveltekit:prefetch href="/poems">Poems</a>
				</li>
			</ul>
		</nav>
	</div>
</header>

<style>
	figure {
		position: absolute;
		background: var(--b-lt);
		border: 0.33rem solid var(--b-md);
		border-radius: 50%;
		overflow: hidden;
		height: 4rem;
		width: 4rem;
		left: 0;
		margin-left: -2rem;
		margin-top: 0.5rem;
		cursor: pointer;
	}
	img {
		height: 4rem;
		position: absolute;
	}
	header {
		position: fixed;
		display: flex;
		justify-content: space-around;
		position: fixed;
		top: 0;
		width: 100%;
		height: var(--header-height);
		background-image: linear-gradient(var(--o-md) 75%, var(--o-dk));
		border-bottom: var(--space-md) solid var(--p-dk);
		z-index: 100;
		flex-grow: 1;
	}
	
	h1 {
		line-height: var(--header-height);
		white-space: nowrap;
	}
	
	nav {
		display: flex;
		justify-content: center;
	}
	ul {
		padding: 0;
		margin: 0;
		height: var(--header-height);
		display: flex;
		justify-content: center;
		align-items: center;
		list-style: none;
		background: var(--background);
		background-size: contain;
	}

	li {
		position: relative;
		height: 100%;
	}

	nav a {
		display: flex;
		height: 100%;
		align-items: center;
		padding: 0 1rem;
		color: var(--off-bk);
		letter-spacing: 0.1em;
		text-decoration: none;
		font-family: "trashhand";
		font-size: 1.33rem;
		color: var(--b-dk);
		transition: transform 0.33s;

	}
	nav a:hover {
		transform: scale(1.15);
		color: var(--b-md);

	}
	div {
		width: 100%;
		max-width: var(--wrapper-width);
		display: flex;
		justify-content: flex-end;
		position: relative;
	}
	div > div {
		position: absolute;
		height: 4rem;
		width: 4rem;
		left: 0;
		overflow: hidden;
	}
</style>

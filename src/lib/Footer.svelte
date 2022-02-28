<script lang="ts">
	import { page } from '$app/stores';
	
	export let footerHeight: number;
</script>

<footer bind:clientHeight={footerHeight}>
	<nav>
		<ul>
			<li class:active={$page.url.pathname === '/'}><a sveltekit:prefetch href="/">Home</a></li>
			<li class:active={$page.url.pathname === '/illustration'}><a sveltekit:prefetch href="/illustration">Illustration</a></li>
			<li class:active={$page.url.pathname === '/poems'}><a sveltekit:prefetch href="/poems">Poems</a></li>
		</ul>
	</nav>
	<h4>
		Built with Strapi and SvelteKit
	</h4>
</footer>

<style>
	footer {
		display: flex;
		justify-content: space-between;
		width: 100%;
		height: var(--footer-height);
		background: #ec7357;
		/* border-top: 0.5rem solid var(--p-md); */
		border-top: 0.5rem solid var(--b-md);

	}
	h4 {
		line-height: var(--footer-height);
		padding-right: 1rem;
	}
	ul {
		padding: 0;
		margin: 0;
		height: var(--footer-height);;
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
		padding: 0 1em;
		color: var(--off-bk);
		font-weight: 700;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-decoration: none;
		transition: color 0.2s linear;
	}

</style>

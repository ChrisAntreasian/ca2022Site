<script lang="ts">
	import { page } from '$app/stores';
	
	export let footerHeight: number;
</script>

<footer bind:clientHeight={footerHeight}>
	<div>
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
	</div>
</footer>

<style>
	footer {
		width: 100%;
		bottom: 0;
		display: flex;
		justify-content: center;
		height: var(--footer-height);
		background-image: linear-gradient(var(--o-md) 75%, var(--o-dk));
		border-top: 0.5rem solid var(--b-dk);
	}
	h4 {
		line-height: var(--footer-height);
		padding-right: 1rem;
		font-family: "josefin-itallic";
		letter-spacing: 0rem;
		font-weight: normal;
		font-size: 1rem;
		color: var(--b-dk);

	}
	ul {
		padding: 0;
		margin: 0;
		height: var(--footer-height);
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
		font-size: 1rem;
		letter-spacing: 0.05em;
		text-decoration: none;
		transition: color 0.2s linear;
		color: var(--b-dk);
		font-family: "josefin-bold";

	}
	nav a:hover {
		transform: scale(1.15);
		color: var(--b-md);

	}
	div {
		max-width: var(--wrapper-width);
		display: flex;
		justify-content: space-between;
		width: 100%;
	}
	@media (max-width: 767.98px) { 
		div {
			flex-direction: column
		}
		footer {
			height: auto;
			padding: 1rem 0;
		}
		ul {
			flex-direction: column;
			align-items: flex-start;
		}
		h4 {
			margin-left: 1rem;
			line-height: 1.5rem;
			padding-top: 1rem;
		}
	 }
</style>

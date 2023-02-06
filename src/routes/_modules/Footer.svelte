<script lang="ts">
	import { page } from "$app/stores";
	import { captureClickThis } from "$lib/analytics";

	export let footerHeight: number;
	const navClick = captureClickThis("footer nav");

</script>

<footer bind:clientHeight={footerHeight}>
	<div class="footer-wrap">
		<nav>
			<ul>
				<li on:click={() => navClick("Home")} on:keypress={() => navClick("Home")} class:active={$page.url.pathname === '/'}>
					<a  href="/">Home</a>
				</li>
				<li on:click={() => navClick("The Quintuplapus")} on:keypress={() => navClick("The Quintuplapus")} class:active={$page.url.pathname === '/the-quintuplapus'}>
					<a  href="/the-quintuplapus">The Quintuplapus</a></li>
				<li on:click={() => navClick("Poems")} on:keypress={() => navClick("Poems")} class:active={$page.url.pathname === '/poems'}>
					<a  href="/poems">Poems</a>
				</li>
			</ul>
		</nav>
		<div class="details">
			<h4>
				Built with Strapi and SvelteKit
			</h4>
			<span>&copy; Christopher Antreasian</span>
		</div>
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
	.footer-wrap {
		max-width: var(--wrapper-width);
		display: flex;
		justify-content: space-between;
		width: 100%;
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
		display: flex;
		height: 100%;
		align-items: center;
		position: relative;
		padding: 0 1em;
	}
	a {
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
	.details {
		display: flex;
		flex-direction: column;
		font-size: 0.75rem;
		justify-content: center;
		align-items: flex-end;
		padding-right: 1rem;
	}
	.details h4,
	.details span {
		font-size: 1rem;
		font-family: "josefin-italic";
	}
	h4 {
		padding-bottom: 0.25rem;
		letter-spacing: 0rem;
		line-height: 1rem;
		color: var(--b-dk);
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

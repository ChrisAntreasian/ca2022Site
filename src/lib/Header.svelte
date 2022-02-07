<script lang="ts">
	import { page } from '$app/stores';
</script>

<header>
	<h1>Christopher Antreasian</h1>
	<nav>
		<ul>
			<li class:active={$page.path === '/'}>
				<a sveltekit:prefetch href="/">Home</a>
			</li>
			<li class:active={$page.path === '/illustration'}>
				<a sveltekit:prefetch href="/illustration">Illustration</a>
			</li>
			<li class:active={$page.path === '/poems'}>
				<a sveltekit:prefetch href="/poems">Poems</a>
			</li>
		</ul>
	</nav>
</header>

<style>
	header {
		position: fixed;
		display: flex;
		justify-content: space-between;
		position: fixed;
		top: 0;
		width: 100%;
		height: var(--header-height);
		background: #ec7357;
		border-bottom: 0.5rem solid var(--md-p);
		z-index: 100;
	}
	
	h1 {
		line-height: var(--header-height);
	}
	
	nav {
		display: flex;
		justify-content: center;
	}

	ul {
		padding: 0;
		margin: 0;
		height: var(--header-height);;
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

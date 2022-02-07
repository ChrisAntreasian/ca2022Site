<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	export const load: Load = async ({ page, fetch, session, stuff }) => {
		const res = await fetch('/illustration.json');
		const aid = parseInt(page.params.aid) || 1;
		if (res.ok) {
			const artPieces = await res.json();

			return {
				props: { 
					artPieces,
					aid
				},
				stuff: {
					artPieces,
					aid
				}
			};
		}
		const { message } = await res.json();
		return {
			error: new Error(message)
		};
	};
</script>

<script lang="ts">
	import type { IllustrationData, Id } from "./../../lib/types";
	import { apiBaseUrl } from "./../_api";
	export let artPieces: IllustrationData;
	export let aid: Id;	

	//before load 
		// get window height
		// X = subract footer height and header height
		// X = set top margin to header height
		// Nav = width 100%
		// Nav = absolute position to the bottom the thumbnail navigation
		// IMG = height = X - Nav
		// Img = max sidth :wrapper width
</script>

<svelte:head>
	<title>Illustration</title>
</svelte:head>

<section>
	<article>
		{#each artPieces.data as art (art.id)}
		{#if art.id === aid}
			<figure>
				<h3>{art.attributes.title}</h3>
				<img src={`${apiBaseUrl}${art.attributes.image.data.attributes.url}`} alt={art.attributes.description} />
				<figcaption>{art.attributes.description}</figcaption>
			</figure>
		{/if}
	{/each}
	</article>
	<nav>
		<ul>
			{#each artPieces.data as art (art.id)}
				<li>
					<a class:active="{art.id === aid}" href="{`/illustration/${art.id}/${art.attributes.title.replace(" ", "-")}`}">
						<img src={`${apiBaseUrl}${art.attributes.image.data.attributes.formats.thumbnail.url}`} alt={art.attributes.description} />
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</section>

<style>

	article {
    border: 0.25rem solid var(--md-p);
		padding: 1rem;
		background-color: white;
		background: linear-gradient(white, var(--off-w));
    border-top-left-radius: var(--corner);
		border-top-right-radius: var(--corner);
		filter: drop-shadow(var(--outershadow));
		box-shadow: inset 0 0 1rem #f3f3f3;
	}
	nav {
		color: var(--off-bk);
		padding: 1rem 0;
		background: var(--md-p);
	}
	ul {
		display: flex;
		list-style: none;
		line-height: 2rem;
		padding: 0;
		font-weight: 600;
		letter-spacing: 0.02rem;
	}
	ul img {
		height: 6rem;
	}
</style>

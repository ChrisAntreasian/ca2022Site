<script lang="ts">
  import { cleanUrlSlug } from "$lib/history";
	import { apiBaseUrl } from "$lib/api";
	import { safeImageString } from "$lib/image";	
  import type { StrapiPageDetails } from "$lib/types";

	export let links: StrapiPageDetails;
</script>

<aside class="bnav bnav-aside">
	<nav class="subnav-list">
  {#each links as ni}
		{#if ni.attributes.title === "My poetry"}
			<div class="rich-link p">
				<div class="details">
					<h2>
						<a href={ni.attributes.link}>
							{ni.attributes.title}
						</a>
					</h2>
					<p>{ni.attributes.description}</p>
				</div>
				<div>
					<h5>My favorites</h5>
					<ul>
						{#each ni.attributes.poems.data as _}
							<li>
								<a href={`poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`}>
									{_.attributes.title}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
		{#if ni.attributes.title === "The Quintuplapus"}
			<div class="rich-link q">
				<div>
					<h2>
						<a href={ni.attributes.link}>
							{ni.attributes.title}
						</a>
					</h2>
					<p>{ni.attributes.description}</p>
				</div>
				{#if ni.attributes.art_piece}
					<img 
						src={`${apiBaseUrl}${safeImageString("small")(ni.attributes.art_piece.data.attributes.image)}`} 
						alt={ni.attributes.art_piece.data.attributes.title} 
					/>
				{/if}
			</div>
		{/if}
	{/each}
		</nav>
	</aside>

<style>
	aside {
		flex-basis: 50%;
	}
	img {
		max-width: 15rem;
	}
	h2 a {
		font-size: 2rem;
		font-family: var(--font-th);
	}
	h5 {
		margin-left: 1rem;
	}
	nav { 		
		padding: 1rem 2rem 2rem;
	}
	.rich-link {
		position: relative;
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--w-xl);
		/* border-top: var(--space-md) solid var(--p-dk);
		border-right: var(--space-md) solid var(--p-dk);
		border-bottom: var(--space-md) solid var(--b-dk);
		border-left: var(--space-md) solid var(--b-dk); */
		border: var(--space-md) solid var(--y-md);
		border-radius: 0.666rem;
	}

	.rich-link {
		display: flex;
	}
	.rich-link:last-of-type {
		margin-bottom: 0;
	}
	.details {
		flex-basis: 60%;
	}
	li {
		margin-bottom: 0.75rem;
	}
	.q.rich-link div {
		flex-basis: 90%;
	}
	.p.rich-link ul{
		flex-basis: 40%;
		margin-top: 0.5rem;
		padding-left: 1rem;
	}
	.rich-link img {
		position: absolute;
		top: 0;
		right: 0;
		height: 150%;
		margin-top:-3%;
		margin-right:-15%;
	}
	@media (max-width: 767.98px) { 
		.subnav {
			position: relative;
		}
		.subnav-list {
			padding: 1rem 1.5rem;
		}
		.rich-link {
			margin-bottom: 1.5rem;
		}
	}

</style>
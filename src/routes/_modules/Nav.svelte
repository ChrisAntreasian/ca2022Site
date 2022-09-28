
<script lang="ts">
	import { s3Bucket } from '$lib/api';
	import { cleanUrlSlug } from "$lib/history";
	import { safeImageString } from "$lib/image";	
  import type { StrapiPageDetails } from "$lib/types";

	export let links: StrapiPageDetails;
	// a tags need analytics
</script>

	<nav class="subnav-list">
  {#each links as ni}
		{#if ni.attributes.title === "My Poetry"}
			<div class="rich-link p">
				<div class="details">
					<h2>
						<a sveltekit:prefetch href={ni.attributes.link}>
							{ni.attributes.title}
						</a>
					</h2>
					<p>{ni.attributes.description}</p>
				</div>
				<div>
					<h4>My Favorites</h4>
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
						<a sveltekit:prefetch href={ni.attributes.link}>
							{ni.attributes.title}
						</a>
					</h2>
					<p>{ni.attributes.description}</p>
				</div>
				{#if ni.attributes.image}
					<img 
						src={`${s3Bucket}${safeImageString("small")(ni.attributes.image)}`} 
						alt={ni.attributes.title} 
					/>
				{/if}
			</div>
		{/if}
	{/each}
</nav>

<style>
	h2 a {
		font-size: 2rem;
		font-family: var(--font-th);
	}
	h4 {
		margin-left: 1rem;
	}
	nav { 		
		padding: 1rem 2rem 2rem;
	}
	.rich-link {
		position: relative;
		display: flex;
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--w-xl);
		border: var(--space-md) solid var(--y-md);
		border-radius: 0.666rem;
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
		flex-basis: 88%;
	}
	.p.rich-link ul{
		flex-basis: 40%;
		margin-top: 0.5rem;
		padding-left: 1rem;
	}
	img {
		position: absolute;
		top: 0;
		right: 0;
		height: 17.5rem;
		margin-top: 0.5rem;
		transform: translateX(50%);
		max-width: 15rem;
		z-index: 1; 
	}
	@media (max-width: 767.98px) {
		.q.rich-link div {
			flex-basis: 90%;
		}
		.subnav-list {
			padding: 1rem 0.75rem;
		}
		.rich-link {
			margin-bottom: 1.5rem;
		}
	}
	@media (max-width: 650px) {
		.q.rich-link div {
			flex-basis: 82%;
		}
	}

</style>
<script lang="ts">
	import { captureClickThis } from "$lib/analytics";
	import { cleanUrlSlug } from "$lib/history";
	import { safeImageString } from "$lib/image";	
  import type { StrapiPageDetails } from "$lib/typing/page";

	export let links: StrapiPageDetails;

const navClick = captureClickThis("home section");
</script>

	<nav class="subnav-list">
  {#each links as ni}
		{#if ni.attributes.title === "Web Experience"}
			<div class="rich-link w">
				<h2>
					<a on:click={() => navClick("Web Experience")} href={ni.attributes.link}>
						{ni.attributes.title}
					</a>
				</h2>
				<p>{ni.attributes.description}</p>
			</div>
		{/if}
		{#if ni.attributes.title === "My Poetry"}
			<div class="rich-link p">
				<div class="details">
					<h2>
						<a on:click={() => navClick("Poems")} href={ni.attributes.link}>
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
								<a on:click={() => navClick(`poem ${_.attributes.title}`)} href={`poems/${_.id}/${cleanUrlSlug(_.attributes.title)}`}>
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
						<a on:click={() => navClick("The Quintuplapus")} href={ni.attributes.link}>
							{ni.attributes.title}
						</a>
					</h2>
					<p>{ni.attributes.description}</p>
				</div>
				{#if ni.attributes.image}
					<img 
						src={`${safeImageString("small")(ni.attributes.image)}`} 
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
	.w.rich-link {
		flex-direction: column;
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
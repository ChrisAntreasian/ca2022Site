<script lang="ts">
	import { apiBaseUrl } from "$api/api.config";
  import type { Art, StrapiPageDetails, WithId } from "$lib/types";

	export let intro: StrapiPageDetails;
  export let images: Array<WithId<Art>>;;
</script>
<section class="home">
  <div class="into-details">
    {#each intro as sec}
      <div class="intro-segment">
        <h2>{sec.attributes.title}</h2>
        {sec.attributes.description}
        
      </div>
    {/each}
    {#each images as img }
      <figure>
        <img src={`${apiBaseUrl}${img.attributes.image.data.attributes.url}`} alt={img.attributes.image.data.attributes.name} />
      </figure>
    {/each}
  </div>

</section>

<style>
  section {
    padding: 1rem;
  }
  img {
    max-width:100%;
    transform:rotate(90deg);
  }
  .intro-segment{
		margin-bottom: 1rem;
	}
</style>
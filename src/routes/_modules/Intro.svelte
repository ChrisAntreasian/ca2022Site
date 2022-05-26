<script lang="ts">
	import { apiBaseUrl } from "$lib/api";	
  import type { IntroDetails } from "$lib/types";

	export let intro: IntroDetails;
</script>
<section class="home">
  <div class="into-details">
    {#each intro.details as sec}
      <div class="intro-segment">
        <h2>{sec.attributes.title}</h2>
        {sec.attributes.description}
      </div>
    {/each}
  </div>
	<figure>
		<img src={`${apiBaseUrl}${intro.image.data.attributes.url}`} alt={intro.image.data.attributes.name} />
	</figure>
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
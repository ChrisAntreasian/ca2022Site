<script lang="ts">
  import type { StrapiPageDetails } from "$lib/types";

	export let intro: StrapiPageDetails;
</script>
<section class="home">
  <div class="into-details">
    {#each intro as sec}
      <div class="intro-segment">
        <h2>{sec.attributes.title}</h2>
        {sec.attributes.description}
      </div>
    {/each}
  </div>
</section>

<style>
  section {
    padding: 1rem;
  }
  .intro-segment{
		margin-bottom: 1rem;
	}
</style>
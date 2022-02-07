<script lang="ts">
  import type { Art } from "../../lib/types";
  import { apiBaseUrl } from "../../lib/api";	
  export let art: Art;
</script>

<article>
  <h3>{art.title}</h3>
  <figure>
    <img 
      src={`${apiBaseUrl}${art.image.data.attributes.url}`} 
      alt={art.description} 
    />
    <figcaption>{art.description}</figcaption>
  </figure>
</article>

<style>
  article {
    border-top-left-radius: var(--corner);
    border-top-right-radius: var(--corner);
  }
</style>
<script lang="ts">
	import { cleanUrlSlug } from "$lib/history";
  import type { ArtWithId } from "$lib/typing/art";

  export let artPiece: ArtWithId;
	export let item: ArtWithId;

  export let handleNavArtPieceClick: (id: number) => (e: Event) => void;
  
  export let parentRoute: string;

</script>

<li class:active={item.id === artPiece.id}>
  <a
    on:click={handleNavArtPieceClick(item.id)}
    href="{`${parentRoute}${item.id}/${cleanUrlSlug(item.attributes.title)}`}"
    class:active="{item.id === artPiece.id}" 
  >
    <img 
      src={`${item.attributes.image.data.attributes.formats.thumbnail.url}`} 
      alt={item.attributes.description} 
    />
  </a>
</li>
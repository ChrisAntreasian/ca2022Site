<script lang="ts">
  import { cleanUrlSlug } from "$lib/history";
  import type { ArtWithId } from "$lib/typing/art";

  interface Props {
    artPiece: ArtWithId;
    item: ArtWithId;
    handleNavArtPieceClick: (id: number) => (e: Event) => void;
    parentRoute: string;
  }

  let { artPiece, item, handleNavArtPieceClick, parentRoute }: Props = $props();
</script>

<li class:active={item.id === artPiece.id}>
  <a
    onclick={handleNavArtPieceClick(item.id)}
    href={`${parentRoute}${item.id}/${cleanUrlSlug(item.attributes.title)}`}
    class:active={item.id === artPiece.id}
  >
    <img
      src={`${item.attributes.image.data.attributes.formats.thumbnail.url}`}
      alt={item.attributes.description}
    />
  </a>
</li>

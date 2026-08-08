<script lang="ts">
  import type { PageServerData } from "./$types";
  import { quintuplapusEditorPath } from "$lib/editing/quintuplapus-editor";

  import Gallary from "$lib/Gallary/index.svelte";
  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();
  let parentRoute = "/the-quintuplapus/";
  let analyticsKey = "the Quintuplapus";
  const editHref = data.editorEnabled
    ? quintuplapusEditorPath(data.artPiece.id, data.artPiece.attributes.title)
    : null;
</script>

<svelte:head>
  <title>The Quintuplapus</title>
</svelte:head>

<Gallary
  artPieces={data.artPieces}
  artPiece={data.artPiece}
  categoryTitle={data.categoryTitle}
  {parentRoute}
  {analyticsKey}
  actionHref={editHref}
  actionLabel="Edit post"
  useUrlTitle={true}
/>

<script lang="ts">
  import type { PageServerData } from "./$types";
  import { quintuplapusEditorPath } from "#lib/editing/resources/quintuplapus/quintuplapus-editor";

  import Gallary from "#lib/Gallary/index.svelte";
  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  // Store references to nested data that will be used multiple times
  const editorEnabled = (() => data.editorEnabled ?? false)();
  const artPiece = (() => data.artPiece)();

  let parentRoute = "/the-quintuplapus/";
  let analyticsKey = "the Quintuplapus";

  // Now we can safely reference these stored values
  const editHref = editorEnabled
    ? quintuplapusEditorPath(artPiece.id, artPiece.attributes.title)
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

<script lang="ts">
  import type { PageServerData } from "./$types";
  import { souljuicerEditorPath } from "$lib/editing/souljuicer-editor";

  import Gallary from "$lib/Gallary/index.svelte";
  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  let parentRoute = "/the-souljuicer/";
  let analyticsKey = "the SoulJuicer";
  const editHref = data.editorEnabled ? souljuicerEditorPath(data.artPiece.id) : null;
</script>

<svelte:head>
  <title>The SoulJuicer</title>
</svelte:head>

<Gallary
  artPieces={data.artPieces}
  artPiece={data.artPiece}
  categoryTitle={"The SoulJuicer"}
  {parentRoute}
  {analyticsKey}
  actionHref={editHref}
  actionLabel="Edit post"
  hideMobileTitle={true}
  useUrlTitle={false}
/>

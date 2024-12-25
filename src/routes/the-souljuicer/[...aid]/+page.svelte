<script lang="ts">
  import type { PageServerData } from "./$types";

  import Gallary from "$lib/Gallary/index.svelte";
  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  let parentRoute = "/the-souljuicer/";
  let analyticsKey = "the SoulJuicer";
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
  hideMobileTitle={true}
  useUrlTitle={false}
/>

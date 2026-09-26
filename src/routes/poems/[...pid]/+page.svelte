<script lang="ts">
  import Article from "$lib/Article/index.svelte";
  import { poemEditorPath } from "$lib/editing/resources/poems/poems-editor";
  import type { PageServerData } from "./$types";

  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  const editHref = data.editorEnabled
    ? poemEditorPath(data.item.id, data.item.title)
    : null;
</script>

<svelte:head>
  <title>Christopher Antreasian: Poems</title>
</svelte:head>

<Article
  item={data.item}
  items={data.items}
  analyticsKey="poem"
  parentRoute="poems"
  defaultHeadline="poetry"
  wrapBasis={70}
  actionHref={editHref}
  actionLabel="Edit post"
/>

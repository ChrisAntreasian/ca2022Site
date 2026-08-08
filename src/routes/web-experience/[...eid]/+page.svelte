<script lang="ts">
  import Article from "$lib/Article/index.svelte";
  import { webExperienceEditorPath } from "$lib/editing/web-experience-editor";
  import type { PageServerData } from "./$types";
  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  const editHref = data.editorEnabled
    ? data.item.id === -1
      ? webExperienceEditorPath({ kind: "intro" })
      : webExperienceEditorPath({ kind: "entry", id: data.item.id }, data.item.title)
    : null;
</script>

<svelte:head>
  <title>Christopher Antreasian: Web Development Experience</title>
</svelte:head>

<Article
  item={data.item}
  items={data.items}
  analyticsKey="web"
  parentRoute="web-experience"
  defaultHeadline="Web Experience"
  actionHref={editHref}
  actionLabel="Edit post"
>
  <a
    class="sidebar-link"
    href="/CA-Resume-2023.pdf"
    target="_blanks"
    download="CA-Resume.pdf"
  >
    &#9660; Download Resume
  </a>
</Article>

<style>
  @media (max-width: 767.98px) {
    a {
      display: block;
      padding: 0 2rem;
    }
  }
</style>

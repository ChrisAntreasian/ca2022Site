<script lang="ts">
  import { mqBreakPoint } from "$lib/spacing";
  import { captureBehavior, captureDetails } from "$lib/analytics";
  import { onMount, type Snippet } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { clientNavigate } from "$lib/history";
  import Shell from "./Shell.svelte";
  import Article from "./Article.svelte";
  import Item from "./Item.svelte";

  import type { Item as ItemT } from "./types";

  type ArticleProps = {
    item: ItemT;
    items: ReadonlyArray<ItemT>;
    analyticsKey: string;
    parentRoute: string;
    defaultHeadline: string;
    wrapBasis?: number;
    children?: Snippet;
  };

  let {
    item,
    items,
    analyticsKey,
    parentRoute,
    defaultHeadline,
    wrapBasis = 100,
    children,
  }: ArticleProps = $props();

  let expanded = $state(false);

  const setItem = (id: number) => (e: Event) => {
    e.preventDefault();
    const nextItem = items.find((i) => i.id === id);

    if (!nextItem) return;

    item = nextItem;
    clientNavigate(true)(`/${parentRoute}/${item.id}`, item.title);
  };

  const handleLinkClick = (i: ItemT) => {
    if (i.id === item.id) return;
    setItem(i.id);
    expanded = false;
    captureBehavior(
      `click ${analyticsKey}`,
      captureDetails({ id: i.id, name: i.title }),
    );
  };
</script>

<Shell activeTitle={item.title} bind:expanded {defaultHeadline} {wrapBasis}>
  {#snippet mainContent()}
    <Article
      {item}
      subnavHeight={0}
      scrollRequestUpdate={false}
      measureHeight={0}
      {analyticsKey}
      {wrapBasis}
    />
  {/snippet}

  {#snippet navContent()}
    {#each items as i (i.id)}
      <Item {item} currentItem={i} {parentRoute} {handleLinkClick} />
    {/each}
    {@render children?.()}
  {/snippet}
</Shell>

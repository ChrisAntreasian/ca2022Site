<script lang="ts">
  import { mqBreakPoint } from "$lib/spacing";
  import { captureBehavior, captureDetails } from "$lib/analytics";
  import { tick, type Snippet } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { clientNavigate } from "$lib/history";
  import Article from "./Article.svelte";
  import Nav from "./Nav.svelte";
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

  let contentHeight: number = $state();
  let measureHeight: number = $state();
  let scrollRequestUpdate: boolean = $state();

  let subnavHeight: number = $state();

  let windowHeight: number = $state();
  let windowWidth: number = $state();
  let scrollY: number = $state();

  let expanded: boolean = $state(false);

  let scrollLogged = $state(false);
  let isAbsolute: boolean = $state();

  const checkIsAbsolute = () => {
    if (windowWidth > mqBreakPoint) return;
    if (!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureHeight;
  };

  $effect.pre(() => {
    async () => {
      await tick();
      checkIsAbsolute();
    };
  });
  afterNavigate(checkIsAbsolute);

  $effect(() => {
    if (scrollY || windowWidth || contentHeight) checkIsAbsolute();
  });

  const setItem = (id: number) => (e: Event) => {
    e.preventDefault();
    item = items.find((i) => i.id === id);
    console.log("setItem", item);
    clientNavigate(true)(`/${parentRoute}/${item.id}`, item.title);
  };

  const handleLinkClick = (i: ItemT) => {
    console.log("handleLinkClick", i);
    if (i.id === item.id) return;
    console.log("after return");
    setItem(i.id);
    expanded = false;
    scrollLogged = false;
    captureBehavior(
      `click ${analyticsKey}`,
      captureDetails({ id: i.id, name: i.title })
    );
  };
</script>

<section
  class="w-sidebar"
  transition:fade|global={{ duration: 300 }}
  bind:clientHeight={contentHeight}
>
  <Article
    {item}
    {subnavHeight}
    {scrollRequestUpdate}
    bind:measureHeight
    {analyticsKey}
    {wrapBasis}
  />
  <Nav
    activeTitle={item.title}
    {contentHeight}
    {measureHeight}
    {scrollRequestUpdate}
    bind:subnavHeight
    bind:expanded
    {defaultHeadline}
  >
    {#each items as i (i.id)}
      <Item {item} currentItem={i} {parentRoute} {handleLinkClick} />
    {/each}
    {@render children?.()}
  </Nav>
</section>

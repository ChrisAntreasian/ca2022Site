<script lang="ts">
  import { mqBreakPoint } from "$lib/spacing";
  import { onMount, type Snippet } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { fade } from "svelte/transition";

  import Nav from "./Nav.svelte";
  type ShellProps = {
    activeTitle: string;
    defaultHeadline: string;
    wrapBasis?: number;
    expanded?: boolean;
    navContent?: Snippet;
    mainContent?: Snippet;
  };

  let {
    activeTitle,
    defaultHeadline,
    wrapBasis = 100,
    expanded = $bindable(false),
    navContent,
    mainContent,
  }: ShellProps = $props();

  let contentHeight: number = $state(0);
  let measureHeight: number = $state(0);
  let scrollRequestUpdate: boolean = $state(false);

  let subnavHeight: number = $state(0);

  let windowHeight: number = $state(0);
  let windowWidth: number = $state(0);
  let scrollY: number = $state(0);

  let isAbsolute: boolean = $state(false);

  const checkIsAbsolute = () => {
    if (windowWidth > mqBreakPoint) return;
    if (!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureHeight;
  };

  afterNavigate(checkIsAbsolute);
  onMount(checkIsAbsolute);

  $effect(() => {
    if (scrollY || windowWidth || contentHeight) checkIsAbsolute();
  });
</script>

<window onresize={checkIsAbsolute}></window>

<section
  class="w-sidebar"
  transition:fade|global={{ duration: 300 }}
  bind:clientHeight={contentHeight}
>
  {@render mainContent?.()}
  <Nav
    {activeTitle}
    {contentHeight}
    {measureHeight}
    {scrollRequestUpdate}
    bind:subnavHeight
    bind:expanded
    {defaultHeadline}
  >
    {@render navContent?.()}
  </Nav>
</section>

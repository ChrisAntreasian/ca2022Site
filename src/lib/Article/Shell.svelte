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

  let contentHeight: number = $state();
  let measureHeight: number = $state();
  let scrollRequestUpdate: boolean = $state();

  let subnavHeight: number = $state();

  let windowHeight: number = $state();
  let windowWidth: number = $state();
  let scrollY: number = $state();

  let isAbsolute: boolean = $state();

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
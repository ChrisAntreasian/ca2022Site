<script lang="ts">
  import Arrow from "$lib/arrow/Arrow.svelte";
  import { mqBreakPoint, toRem } from "$lib/spacing";
  import { captureBehavior } from "$lib/analytics";
  import { type Snippet } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { noScroll } from "$lib/body";
  import { fade } from "svelte/transition";
  type NavProps = {
    activeTitle: string;
    contentHeight: number;
    measureHeight: number;
    scrollRequestUpdate: boolean;
    defaultHeadline: string;
    children?: Snippet;
    subnavHeight: number;
    expanded: boolean;
  };

  let {
    activeTitle,
    contentHeight,
    measureHeight,
    scrollRequestUpdate,
    defaultHeadline,
    subnavHeight = $bindable(),
    expanded = $bindable(false),
    children,
  }: NavProps = $props();

  let windowHeight: number = $state();
  let windowWidth: number = $state();
  let scrollY: number = $state();

  let scrollLogged = false;
  let isAbsolute: boolean = $state();

  const checkIsAbsolute = () => {
    if (windowWidth > mqBreakPoint) return;
    if (!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureHeight;
  };

  afterNavigate(checkIsAbsolute);

  const navHeight = $derived(windowHeight * 0.72);
  $effect(() => {
    if (scrollY || windowWidth || contentHeight) checkIsAbsolute();
  });

  const handleMNavHandle = () => {
    expanded = !expanded;
    captureBehavior("click expand mobile nav", { expanded: expanded });
    scrollLogged = false;
  };

  const scrollMNav = () => {
    if (!scrollLogged) {
      captureBehavior("scroll mobile nav");
      scrollLogged = true;
    }
  };
</script>

<svelte:window
  bind:innerHeight={windowHeight}
  bind:innerWidth={windowWidth}
  bind:scrollY
  onresize={checkIsAbsolute}
/>

<svelte:body use:noScroll={expanded} />

{#if expanded}
  <div
    class="bg-overlay"
    role="button"
    tabindex="0"
    onclick={handleMNavHandle}
    onkeypress={handleMNavHandle}
    transition:fade|global={{ duration: 200 }}
  ></div>
{/if}

<nav
  class="bnav bnav-aside subnav"
  class:absolute={isAbsolute}
  bind:clientHeight={subnavHeight}
>
  <div class="subnav-wrap">
    <button
      class="subnav-handle"
      onclick={handleMNavHandle}
      onkeypress={handleMNavHandle}
    >
      <h3>{expanded ? defaultHeadline : activeTitle}</h3>
      <div class="subnav-action">
        <Arrow
          direction={expanded ? "bottom" : "top"}
          color="white"
          size="medium"
        />
      </div>
    </button>
    <div class="subnav-content">
      <ul
        onscroll={scrollMNav}
        class:expanded
        style="--nav-height: {toRem(navHeight)}rem"
      >
        {@render children?.()}
      </ul>
    </div>
  </div>
</nav>

<style>
  ul {
    line-height: 2rem;
    letter-spacing: 0.01rem;
    padding: 1rem 2rem 2rem;
  }
  .bg-overlay {
    display: none;
  }
  @media (max-width: 767.98px) {
    nav {
      z-index: 50;
    }
    .subnav-handle {
      height: var(--header-height);
      width: 100%;
      display: flex;
      justify-content: space-between;
    }
    .subnav.absolute {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }
    ul {
      padding: 0;
    }
    .bg-overlay {
      display: block;
    }
  }
</style>

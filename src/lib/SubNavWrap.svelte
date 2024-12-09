<script lang="ts">
  import { getContext } from "svelte";
  import { captureBehavior } from "./analytics";
  import Arrow from "./arrow/Arrow.svelte";
  import {
    contextHeightKey,
    fromRem,
    rem,
    toRem,
    type LayoutElemH,
  } from "./spacing";

  interface Props {
    expanded: boolean;
    analyticsKey: string;
    pieceTitle: string;
    subnavHeight: number;
    setExpanded: (v: boolean) => void;
    categoryTitle: string;
    asideNav?: boolean;
    navOffset?: string;
    left?: import("svelte").Snippet;
    primary?: import("svelte").Snippet;
    right?: import("svelte").Snippet;
  }

  let {
    expanded,
    analyticsKey,
    pieceTitle,
    subnavHeight = $bindable(),
    setExpanded,
    categoryTitle,
    asideNav = false,
    navOffset = null,
    left,
    primary,
    right,
  }: Props = $props();

  let subnavWidth: number = $state();
  let windowHeight: number = $state();
  let windowWidth: number = $state();
  let scrollY: number = $state();
  let scrollLogged = false;

  let navHeight: number = $derived(windowHeight * 0.72);

  // const { getMainHeight }: LayoutElemH = getContext(contextHeightKey);

  const handleMNavClick = () => {
    setExpanded(!expanded);
    captureBehavior(`${analyticsKey} click expand mobile nav`, {
      expanded: expanded,
    });
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
/>

<nav
  class="bnav subnav"
  class:bnav-aside={asideNav}
  class:absolute={windowHeight + scrollY > subnavHeight + fromRem(2)}
  bind:clientWidth={subnavWidth}
  bind:clientHeight={subnavHeight}
  style={`--window-width: ${windowWidth / rem}rem`}
>
  <div class="subnav-wrap">
    <div
      class="subnav-handle"
      onclick={handleMNavClick}
      onkeypress={handleMNavClick}
    >
      <h3>
        {expanded ? categoryTitle : pieceTitle}
      </h3>
      <div class="subnav-icon">
        <Arrow
          direction={expanded ? "bottom" : "top"}
          color="white"
          size="medium"
        />
      </div>
    </div>
    {@render left?.()}
    <ul
      onscroll={scrollMNav}
      class:expanded
      style={`
      --nav-height: ${toRem(navHeight)}rem
      ${navOffset ? navOffset : ""}
    `}
    >
      {@render primary?.()}
    </ul>
  </div>
  {@render right?.()}
</nav>

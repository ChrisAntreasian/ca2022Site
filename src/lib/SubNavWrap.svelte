
<script lang="ts">
	import { getContext } from "svelte";
	import { captureBehavior } from "./analytics";
	import Arrow from "./arrow/Arrow.svelte";
	import { contextHeightKey, fromRem, rem, toRem, type LayoutElemH } from "./spacing";


  export let expanded: boolean;
  export let analyticsKey: string;
  export let pieceTitle: string;
  export let subnavHeight: number;
  export let setExpanded: (_:boolean) => void;
  export let categoryTitle: string;

  export let asideNav: boolean = false;
  export let navOffset: string = null;

  let subnavWidth: number;
  let windowHeight: number;
  let windowWidth: number;
  let scrollY: number;
  let scrollLogged = false;

  const { getMainHeight }: LayoutElemH = getContext(contextHeightKey);
  
  $: navHeight = windowHeight * 0.72;

  const handleMNavClick = () => {
    setExpanded(!expanded)
    captureBehavior(`${analyticsKey} click expand mobile nav`, {expanded: expanded});
    scrollLogged = false
  }

  const scrollMNav = () => {
    if (!scrollLogged) {
      captureBehavior("scroll mobile nav");
      scrollLogged = true;
    }
  }


</script>

<svelte:window 
  bind:innerHeight={windowHeight} 
  bind:innerWidth={windowWidth}
  bind:scrollY={scrollY}
/>

<nav class="bnav subnav" 
  class:bnav-aside={asideNav} 
  class:absolute={windowHeight + scrollY > getMainHeight() + subnavHeight + fromRem(2)}
  bind:clientWidth={subnavWidth} 
  bind:clientHeight={subnavHeight} 
  style={`--window-width: ${windowWidth / rem}rem`}
>  
  <div class="subnav-wrap">
    <div class="subnav-handle" 
      on:click={handleMNavClick} 
      on:keypress={handleMNavClick}
    >
      <h3>
        {expanded ? categoryTitle: pieceTitle}
      </h3>
      <div class="subnav-icon">
        <Arrow direction={expanded ? "bottom": "top"} color="white" size="medium" />
      </div>
    </div>
    <slot name="left"></slot>
    <ul 
    on:scroll={scrollMNav} 
    class:expanded={expanded} 
    style={`
      --nav-height: ${toRem(navHeight)}rem
      ${navOffset ? navOffset : ""}
    `}>
      <slot name="primary"></slot>  
    </ul>
  </div>
  <slot name="right"></slot>

</nav>

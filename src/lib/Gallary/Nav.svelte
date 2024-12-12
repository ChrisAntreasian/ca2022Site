<script lang="ts">
  import { afterNavigate } from "$app/navigation";

  import { cleanUrlSlug } from "$lib/history";
  import { captureBehavior } from "$lib/analytics";

  import {
    wrapperWidth,
    rem,
    toRem,
    fromRem,
    mqBreakPoint,
  } from "$lib/spacing";

  import Arrow from "$lib/arrow/Arrow.svelte";
  import type { ArtWithId } from "$lib/typing/art";

  import { noScroll } from "$lib/body";
  import { fade } from "svelte/transition";
  import { tick } from "svelte";

  type NavProps = {
    expanded: boolean;
    setExpanded: (v: boolean) => void;
    categoryTitle: string;
    analyticsKey: string;
    parentRoute: string;
    subnavHeight: number;
    gallarySectionHeight: number;
    scrollRequestUpdate: boolean;
    measureH: number;
    artPieces: Array<ArtWithId>;
    artPiece: ArtWithId;
    navArtPieceClick: (i: number) => (e: Event) => void;
  };
  let {
    expanded,
    setExpanded,
    categoryTitle,
    analyticsKey,
    parentRoute,
    subnavHeight = $bindable(),
    scrollRequestUpdate = $bindable(),
    measureH,
    artPieces,
    artPiece,
    navArtPieceClick,
  }: NavProps = $props();

  let windowHeight: number = $state();
  let windowWidth: number = $state();
  let navHeight = $state(windowHeight * 0.72);
  let subnavWidth: number = $state();

  let isAbsolute: boolean = $state(false);

  let scrollY: number = $state();
  let scrollLogged = $state(false);

  let activeItemIndex = $state(0);
  let itemsPerPage = $state(0);

  const thubmnailWidth = fromRem(6);

  const checkIsAbsolute = () => {
    if (windowWidth > mqBreakPoint) return;
    if (!scrollRequestUpdate) scrollRequestUpdate = true;

    isAbsolute = scrollY + windowHeight - subnavHeight > measureH;
  };

  const initNav = () => {
    checkIsAbsolute();
    itemsPerPage = Math.floor(
      (subnavWidth ? subnavWidth : wrapperWidth) / (thubmnailWidth + rem)
    );
  };

  $effect.pre(() => {
    async () => {
      await tick();
      console.log("called from inde nav");

      initNav();
    };
  });

  afterNavigate(initNav);

  $effect(() => {
    artPieceChanged(artPiece.id);
  });

  const apPosition = (apid: number) =>
    artPieces.findIndex((p) => p.id === apid);

  const paginate = (n: number) => {
    const aii = activeItemIndex + n * (itemsPerPage - 1);
    activeItemIndex =
      aii < 0 ? 0 : aii > artPieces.length ? artPieces.length : aii;
  };

  const artPieceChanged = (apId: number) => {
    const apP = apPosition(apId);
    if (activeItemIndex !== 0 && apP < activeItemIndex) {
      paginate(-1);
    } else if (apP > activeItemIndex + (itemsPerPage - 1)) {
      paginate(1);
    }
  };

  const paginateClick = (n: number) => {
    paginate(n);
    captureBehavior(`${analyticsKey} click slider ${n > 0 ? "next" : "last"}`, {
      activeIndex: activeItemIndex,
      itemsPerPage: itemsPerPage,
    });
  };

  const handleNavArtPieceClick = (id: number) => {
    setExpanded(false);
    scrollLogged = false;
    return navArtPieceClick(id);
  };

  const handleMNavClick = () => {
    setExpanded(!expanded);
    captureBehavior(`${analyticsKey} click expand mobile nav`, {
      expanded: expanded,
    });
    scrollLogged = false;
  };

  const scrollMNav = () => {
    if (!scrollLogged) {
      captureBehavior(`${analyticsKey} scroll mobile nav`);
      scrollLogged = true;
    }
  };
</script>

<svelte:window
  bind:innerHeight={windowHeight}
  bind:innerWidth={windowWidth}
  bind:scrollY
/>
<svelte:body use:noScroll={expanded} />

{#if expanded}
  <div
    class="bg-overlay"
    onclick={handleMNavClick}
    onkeypress={handleMNavClick}
    transition:fade|global={{ duration: 200 }}
  ></div>
{/if}
<nav
  class="bnav subnav"
  class:absolute={isAbsolute}
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
      <h3>{expanded ? categoryTitle : artPiece.attributes.title}</h3>
      <div class="subnav-icon">
        <Arrow
          direction={expanded ? "bottom" : "top"}
          color="white"
          size="medium"
        />
      </div>
    </div>
    {#if activeItemIndex > 0}
      <div
        class="last"
        onclick={() => paginateClick(-1)}
        onkeypress={() => paginateClick(-1)}
      >
        <Arrow direction="left" color="white" size="large" />
      </div>
    {/if}
    <div class="subnav-content">
      <ul
        onscroll={scrollMNav}
        class:expanded
        style={`
          --nav-height: ${toRem(navHeight)}rem;
          --nav-offset: ${toRem(activeItemIndex * thubmnailWidth) * -1}rem;
        `}
      >
        {#each artPieces as p}
          <li class:active={p.id === artPiece.id}>
            <a
              onclick={() => handleNavArtPieceClick(p.id)}
              href={`${parentRoute}${p.id}/${cleanUrlSlug(p.attributes.title)}`}
              class:active={p.id === artPiece.id}
            >
              <img
                src={`${p.attributes.image.data.attributes.formats.thumbnail.url}`}
                alt={p.attributes.description}
              />
            </a>
          </li>
        {/each}
      </ul>
    </div>
    {#if activeItemIndex + itemsPerPage < artPieces.length}
      <div
        class="next"
        onclick={() => paginateClick(1)}
        onkeypress={() => paginateClick(1)}
      >
        <Arrow direction="right" color="white" size="large" />
      </div>
    {/if}
  </div>
</nav>

<style>
  nav {
    width: 100%;
    height: 6rem;
    position: absolute;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    background-image: linear-gradient(var(--p-dk), var(--p-md));
  }
  .subnav {
    width: var(--window-width);
    border-top: var(--space-md) solid var(--y-md);
  }
  .subnav-wrap {
    width: calc(var(--wrapper-width) - 7rem);
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
    padding: 0 4.5rem;
  }
  .subnav-wrap:before,
  .subnav-wrap:after {
    content: "";
    width: 4.5rem;
    height: 100%;
    position: absolute;
    z-index: 10;
    background: var(--p-dk);
    background-image: linear-gradient(var(--p-dk), var(--p-md));
  }
  .subnav-wrap:before {
    left: 0;
    mask-image: linear-gradient(to left, transparent 25%, black 50%);
  }
  .subnav-wrap:after {
    right: 0;
    mask-image: linear-gradient(to right, transparent 25%, black 50%);
  }
  .subnav-content {
    width: 100%;
    height: 100%;
    position: relative;
  }
  .last,
  .next {
    position: absolute;
    z-index: 20;
    transition: transform 0.2s ease-in-out;
  }
  .last:hover,
  .next:hover {
    transform: scale(1.15);
  }
  .last {
    left: 0;
  }
  .next {
    right: 0;
  }
  ul {
    height: 100%;
    display: flex;
    align-items: center;
    position: absolute;
    padding: 0;
    left: 0;
    margin-left: var(--nav-offset);
    transition:
      height 0.33s ease-in-out,
      margin-left 0.4s ease-in-out,
      opacity 0.4s ease-in-out 0.2s;
  }
  li img {
    height: auto;
    width: 100%;
    object-fit: cover;
    border-radius: 0.333rem;
  }
  li {
    margin-right: 1rem;
    border-radius: 0.333rem;
    transition: transform 0.2s ease-in-out;
  }
  li:last-of-type {
    margin-left: 0;
  }
  li:hover,
  li.active {
    transform: scale(1.15);
  }
  li.active {
    outline: 0.2rem solid var(--y-md);
  }

  li a {
    width: 5rem;
    height: 4rem;
    display: flex;
  }
  .bg-overlay {
    display: none;
  }
  @media (max-width: 767.98px) {
    nav {
      height: auto;
      width: auto;
      position: fixed;
      padding: 0;
      z-index: 50;
    }
    .subnav.absolute {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }
    .subnav-wrap {
      width: 100%;
      flex-direction: column;
      padding: 0;
    }

    .subnav-wrap::before,
    .subnav-wrap::after {
      display: none;
    }
    ul {
      height: 0;
      position: relative;
      flex-wrap: wrap;
      margin-left: 0 !important;
      justify-content: space-around;
      opacity: 1 !important;
    }
    .subnav ul {
      height: 0;
      overflow: hidden;
      transition: height 0.33s ease-in-out;
    }
    ul.expanded {
      height: var(--nav-height);
      overflow: scroll;
    }
    .subnav ul.expanded {
      height: var(--nav-height);
    }

    li {
      margin: 1.5rem 0.5rem;
    }

    li a {
      width: 8rem;
      height: 8rem;
    }
    .next,
    .last {
      display: none;
    }
    .bg-overlay {
      display: block;
    }
  }
</style>

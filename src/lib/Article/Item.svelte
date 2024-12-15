<script lang="ts">
  import { cleanUrlSlug } from "$lib/history";
  import type { Item } from "./types";

  interface Props {
    item: Item;
    currentItem: Item;
    parentRoute: string;
    handleLinkClick: (i: Item) => void;
  }

  let { item, currentItem, parentRoute, handleLinkClick }: Props = $props();
</script>

<li class:active={currentItem.id === item.id}>
  <a
    class="sidebar-link"
    href={`/${parentRoute}/${currentItem.id}/${cleanUrlSlug(currentItem.title)}`}
    onclick={() => handleLinkClick(currentItem)}
  >
    {#if !currentItem.omitFromNav}
      {#if currentItem.logo}
        <div class="rich-link">
          <img src={currentItem.logo} alt={currentItem.title} />
        </div>
      {:else}
        {currentItem.title}
      {/if}
    {/if}
  </a>
</li>

<style>
  li {
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }
  img {
    height: 2rem;
  }
  .rich-link {
    transition: border 250ms ease-out;
  }
  .rich-link:hover {
    border-color: var(--y-lt);
  }
  @media (max-width: 767.98px) {
    li {
      padding: 0 1.5rem;
    }
    li:first-of-type {
      padding-top: 1rem;
    }
    li:last-of-type {
      padding-bottom: 2rem;
    }
  }
</style>

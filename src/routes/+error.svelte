<script lang="ts">
  import { page } from "$app/state";
  import { getContext, hasContext } from "svelte";
  import { contextHeightKey, rem } from "#lib/spacing";
  import type { LayoutElemH } from "#lib/spacing";

  let windowHeight: number = $state(0);

  // `+error.svelte` renders for a page-level error *and* for a layout-level one. When the root layout
  // itself failed, it never ran far enough to `setContext(contextHeightKey, ...)`, so asking for that
  // context unconditionally made the boundary throw while it was trying to report an error — which
  // looked like a broken landing page rather than a readable error. Presence is checked before use;
  // absent heights read as zero, which only affects the min-height the section asks for.
  const heights: LayoutElemH | undefined = hasContext(contextHeightKey)
    ? getContext<LayoutElemH>(contextHeightKey)
    : undefined;

  const getHeaderHeight = () => heights?.getHeaderHeight() ?? 0;
  const getFooterHeight = () => heights?.getFooterHeight() ?? 0;

  const image = [500, 404, 403].includes(page.status)
    ? `/${page.status}.jpg`
    : "/500.jpg";
</script>

<svelte:window bind:innerHeight={windowHeight} />

<section
  style={`--min-height: ${(windowHeight - getHeaderHeight() - getFooterHeight()) / rem}rem`}
>
  <div>
    <h3>{page.status}</h3>
    <h4>: {page?.error?.message || ""}</h4>
  </div>
  <img src={image} alt={`${page.status} image`} />
</section>

<style>
  section {
    margin: 4rem 0 2rem;
    flex-direction: column;
    align-items: center;
    min-height: var(--min-height);
  }
  div {
    display: flex;
    margin-bottom: 1rem;
  }
  h3 {
    color: var(--off-bk);
  }
  h4 {
    line-height: var(--header-height);
  }
</style>

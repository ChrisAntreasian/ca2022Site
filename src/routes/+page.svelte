<script lang="ts">
  import { safeImageString } from "#lib/image";
  import { getContext } from "svelte";
  import { contextHeightKey, rem, type LayoutElemH } from "#lib/spacing";
  import Nav from "./_modules/Nav.svelte";
  import type { PageServerData } from "./$types";

  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  const { getHeaderHeight, getFooterHeight }: LayoutElemH =
    getContext(contextHeightKey);
  let windowHeight: number = $state();

  const editHref = $derived(data.editorEnabled ? data.landingEditorHref : null);
</script>

<svelte:head>
  <title>Christopher Antreasian: Home</title>
</svelte:head>

<svelte:window bind:innerHeight={windowHeight} />
<section class="w-sidebar">
  <article
    class="home"
    style={`--min-height: ${(windowHeight - getHeaderHeight() - getFooterHeight()) / rem}rem`}
  >
    {#each data.intro as sec}
      <div class="intro-segment">
        <div class="home-wrap">
          {#if editHref}
            <div class="home-actions">
              <a class="post-action-link" href={editHref}>Edit home</a>
            </div>
          {/if}

          <h2>{sec.attributes.title}</h2>
          <p>{sec.attributes.description}</p>
        </div>
        {#if sec.attributes.image}
          <img
            src={`${safeImageString("original")(sec.attributes.image)}`}
            alt={sec.attributes.title}
          />
        {/if}
      </div>
    {/each}
  </article>

  <aside class="bnav bnav-aside">
    <Nav links={data.links} />
  </aside>
</section>

<style>
  h2 {
    color: var(--b-md);
    margin-top: 2.5rem;
    font-size: 2.5rem;
  }
  article {
    flex-basis: 50%;
    min-height: var(--min-height);
    padding: 0rem 2rem 2rem;
    margin-top: 0;
    justify-content: space-between;
  }

  .intro-segment {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .home-wrap {
    position: relative;
  }
  .home-actions {
    position: absolute;
    top: 0;
    right: 0;
    margin-top: 1.5rem;
    display: flex;
    justify-content: flex-end;
  }
  .post-action-link {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--bg-dk);
    text-decoration: none;
    font-family: var(--font-jsf);
    font-size: 1.15rem;
    line-height: 1.5rem;
  }

  .post-action-link:hover {
    color: var(--bg-lt);
  }
  img {
    width: 100%;
    justify-self: flex-end;
  }
  aside {
    flex-basis: 50%;
    flex-shrink: 0;
  }
  @media (max-width: 767.98px) {
    section.w-sidebar {
      align-items: center;
      flex-direction: column-reverse;
    }
    h2 {
      padding-bottom: 0.5rem;
      font-size: 2.5rem;
      text-align: left;
      order: 1;
      margin-bottom: 1rem;
    }
    article {
      padding: 0 1rem;
      min-height: auto;
      order: 3;
    }
    aside {
      order: 2;
      padding: 0.5rem 0;
      border-bottom: var(--space-md) solid var(--y-md);
    }
    .home-actions {
      position: static;
      margin: 1.5rem 0 1rem;
    }
  }
</style>

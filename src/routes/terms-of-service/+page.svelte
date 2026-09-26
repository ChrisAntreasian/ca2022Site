<script lang="ts">
  import SvelteMarkdown from "svelte-exmarkdown";
  import type { PageServerData } from "./$types";

  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();
  const editHref = $derived(
    data.editorEnabled ? "/terms-of-service/edit" : null,
  );
</script>

<svelte:head>
  <title>Terms of Service | Christopher Antreasian</title>
</svelte:head>

<section class="terms-page">
  <article class="terms-article">
    <div class="terms-wrap">
      {#if editHref}
        <div class="terms-actions">
          <a class="post-action-link" href={editHref}>Edit post</a>
        </div>
      {/if}

      <h2>{data.terms.title}</h2>
      <SvelteMarkdown md={data.terms.bodyMarkdown} />
    </div>
  </article>
</section>

<style>
  .terms-page {
    width: 100%;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    padding: 1.3333rem 2rem 2rem;
    min-height: calc(100vh - var(--header-height) - var(--footer-height));
  }

  .terms-wrap {
    position: relative;
  }

  .terms-actions {
    position: absolute;
    top: 0;
    right: 0;
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

  h2 {
    margin: 0 0 1rem;
    color: var(--b-dk);
  }

  :global(.terms-wrap p) {
    margin: 0 0 1rem;
    color: var(--off-bk);
    line-height: 1.5rem;
  }

  :global(.terms-wrap a) {
    color: var(--b-md);
    text-decoration: underline;
  }

  @media (max-width: 767.98px) {
    .terms-page {
      padding: 1.3333rem 1rem calc(var(--snh) + 2rem);
    }

    .terms-wrap {
      max-width: 30rem;
    }

    .terms-actions {
      position: static;
      margin: 0 0 1rem;
    }

    h1 {
      padding-right: 0;
    }
  }
</style>

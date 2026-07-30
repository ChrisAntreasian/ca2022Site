<script lang="ts">
  import Button from "./Button.svelte";
  import TextInput from "./TextInput.svelte";

  interface Props {
    title: string;
    description: string;
    authorized: boolean;
    hasConfig: boolean;
    message?: string;
    messageSuccess?: boolean;
    newHref: string;
    newLabel: string;
    sidebarTitle: string;
    authorizeAction?: string;
    logoutAction?: string;
    unlockTitle?: string;
    missingConfigTitle?: string;
    missingConfigMessage?: string;
    sidebar?: import("svelte").Snippet;
    content?: import("svelte").Snippet;
  }

  let {
    title,
    description,
    authorized,
    hasConfig,
    message,
    messageSuccess = false,
    newHref,
    newLabel,
    sidebarTitle,
    authorizeAction = "?/authorize",
    logoutAction = "?/logout",
    unlockTitle = "Unlock edit mode",
    missingConfigTitle = "Missing edit key",
    missingConfigMessage = "Set CONTENT_EDIT_KEY in your server environment before using the editor.",
    sidebar,
    content,
  }: Props = $props();
</script>

<section class="editor-shell">
  <article class="editor-panel">
    <header class="editor-header">
      <div class="intro">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {#if authorized}
        <form method="POST" action={logoutAction}>
          <Button type="submit" variant="secondary">Lock editor</Button>
        </form>
      {/if}
    </header>

    {#if message}
      <p class:success={messageSuccess} class="message">{message}</p>
    {/if}

    {#if !hasConfig}
      <div class="state-card warning">
        <h2>{missingConfigTitle}</h2>
        <p>{missingConfigMessage}</p>
      </div>
    {:else if !authorized}
      <div class="state-card auth-card">
        <h2>{unlockTitle}</h2>
        <form class="auth-form" method="POST" action={authorizeAction}>
          <TextInput
            id="editKey"
            name="editKey"
            type="password"
            label="Edit key"
            autocomplete="current-password"
          />
          <Button type="submit" fullWidth>Unlock</Button>
        </form>
      </div>
    {:else}
      <div class="editor-layout">
        <div class="content-panel">
          {@render content?.()}
        </div>

        <aside class="sidebar-panel">
          <div class="sidebar-head">
            <h2>{sidebarTitle}</h2>
            <Button href={newHref} variant="secondary">{newLabel}</Button>
          </div>
          {@render sidebar?.()}
        </aside>
      </div>
    {/if}
  </article>
</section>

<style>
  .editor-shell {
    width: 100%;
    margin-top: var(--header-height);
    padding: 1rem;
    box-sizing: border-box;
  }

  .editor-panel {
    width: 100%;
    box-sizing: border-box;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .intro {
    max-width: 48rem;
  }

  .editor-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 19rem;
    gap: 1rem;
    margin-top: 1rem;
    align-items: start;
  }

  .content-panel,
  .sidebar-panel,
  .state-card {
    background: var(--w-lt);
    border: var(--space-md) solid var(--y-md);
    box-shadow: var(--outershadow);
    padding: 1rem;
    box-sizing: border-box;
  }

  .sidebar-panel {
    position: sticky;
    top: calc(var(--header-height) + 1rem);
  }

  .sidebar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .auth-card {
    max-width: 26rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .message {
    margin-top: 1rem;
    color: var(--o-dk);
  }

  .message.success {
    color: var(--b-dk);
  }

  .warning {
    border-color: var(--o-md);
  }

  @media (max-width: 767.98px) {
    .editor-shell {
      padding: 0.75rem;
    }

    .editor-header,
    .editor-layout {
      display: flex;
      flex-direction: column;
    }

    .sidebar-panel {
      position: static;
      width: 100%;
    }
  }
</style>

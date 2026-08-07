<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";

  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";

  import Shell from "./Shell.svelte";

  interface Props {
    activeTitle: string;
    defaultHeadline: string;
    wrapBasis?: number;
    editorTitle: string;
    editorDescription: string;
    formMessage?: string;
    savedMessage?: string | null;
    savedTitle: string;
    isDirty: boolean;
    formElement?: HTMLFormElement | null;
    editorPane?: Snippet;
    navigationPane?: Snippet<[(path: string) => void]>;
  }

  let {
    activeTitle,
    defaultHeadline,
    wrapBasis = 100,
    editorTitle,
    editorDescription,
    formMessage,
    savedMessage = null,
    savedTitle,
    isDirty,
    formElement = $bindable(null),
    editorPane,
    navigationPane,
  }: Props = $props();

  let pendingPath: string | null = $state(null);
  let showUnsavedWarning = $state(false);
  let showSavedNotice = $state(Boolean(savedMessage));

  $effect(() => {
    showSavedNotice = Boolean(savedMessage);
  });

  const requestNavigation = (path: string) => {
    if (path === page.url.pathname) return;
    if (!isDirty) {
      window.location.href = path;
      return;
    }

    pendingPath = path;
    showUnsavedWarning = true;
  };

  const closeUnsavedWarning = () => {
    pendingPath = null;
    showUnsavedWarning = false;
  };

  const handleLeave = () => {
    if (!pendingPath) return;
    const nextPath = pendingPath;
    closeUnsavedWarning();
    window.location.href = nextPath;
  };

  const handleSaveAndContinue = () => {
    if (!pendingPath || !formElement) return;

    const redirectInput = formElement.querySelector(
      'input[name="redirectTo"]',
    ) as HTMLInputElement | null;

    if (redirectInput) {
      redirectInput.value = pendingPath;
    }

    showUnsavedWarning = false;
    formElement.requestSubmit();
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  };

  const closeSavedNotice = () => {
    showSavedNotice = false;
  };
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<Shell {activeTitle} {defaultHeadline} {wrapBasis}>
  {#snippet mainContent()}
    <article class="edit-article">
      <div class="edit-head">
        <div>
          <h2>{editorTitle}</h2>
          <p>{editorDescription}</p>
        </div>
      </div>

      {#if formMessage}
        <p class="message">{formMessage}</p>
      {/if}

      {@render editorPane?.()}
    </article>
  {/snippet}

  {#snippet navContent()}
    {@render navigationPane?.(requestNavigation)}
  {/snippet}
</Shell>

<UnsavedChangesDialog
  open={showUnsavedWarning}
  onStay={closeUnsavedWarning}
  onLeave={handleLeave}
  onSaveAndContinue={handleSaveAndContinue}
/>

<UnsavedChangesDialog
  open={showSavedNotice}
  title={savedTitle}
  message={savedMessage ?? "Your changes were saved."}
  onContinue={closeSavedNotice}
  autoDismissMs={1500}
/>

<style>
  .edit-article {
    width: 66.66%;
    min-height: var(--min-height);
    padding: 1.3333rem 2rem 2rem;
    box-sizing: border-box;
  }

  .edit-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .message {
    margin: 0 0 1rem;
    color: var(--o-dk);
  }

  @media (max-width: 767.98px) {
    .edit-article {
      width: 100%;
      padding: 1.3333rem 1rem calc(var(--snh) + 2rem);
    }

    .edit-head {
      flex-direction: column;
    }
  }
</style>

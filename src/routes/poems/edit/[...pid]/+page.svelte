<script lang="ts">
  import { page } from "$app/state";
  import EditPane from "$lib/Article/EditPane.svelte";
  import Shell from "$lib/Article/Shell.svelte";
  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";
  import { poemEditorPath } from "../editor";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  let currentPoem = $state(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.selectedPoem,
  );

  const baselinePoem = data.selectedPoem;
  const dirty = $derived(JSON.stringify(currentPoem) !== JSON.stringify(baselinePoem));

  let pendingPath: string | null = $state(null);
  let showUnsavedWarning = $state(false);
  let showSavedNotice = $state(Boolean(data.savedMessage));
  let saveAndContinueForm: HTMLFormElement | null = $state(null);

  const requestNavigation = (path: string) => {
    if (path === page.url.pathname) return;
    if (!dirty) {
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
    if (!pendingPath || !saveAndContinueForm) return;

    const redirectInput = saveAndContinueForm.querySelector(
      'input[name="redirectTo"]',
    ) as HTMLInputElement | null;

    if (redirectInput) {
      redirectInput.value = pendingPath;
    }

    showUnsavedWarning = false;
    saveAndContinueForm.requestSubmit();
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  };

  const closeSavedNotice = () => {
    showSavedNotice = false;
  };
</script>

<svelte:head>
  <title>Poems Editor</title>
</svelte:head>

<svelte:window onbeforeunload={handleBeforeUnload} />

<Shell activeTitle={currentPoem.title} defaultHeadline="poetry" wrapBasis={70}>
  {#snippet mainContent()}
    <article class="edit-article">
      <div class="edit-head">
        <div>
          <h2>Poems Editor</h2>
          <p>Edit the current poem in the article pane while keeping the existing poems navigation structure.</p>
        </div>
      </div>

      {#if form?.message}
        <p class="message">{form.message}</p>
      {/if}

      <EditPane
        bind:poem={currentPoem}
        bind:formElement={saveAndContinueForm}
        saveLabel={currentPoem.id > 0 ? "Save poem" : "Create poem"}
      />
    </article>
  {/snippet}

  {#snippet navContent()}
    <li class="nav-action-item">
      <a
        class="sidebar-link"
        href={data.editor.newPath}
        onclick={(event) => {
          event.preventDefault();
          requestNavigation(data.editor.newPath);
        }}
      >
        + New poem
      </a>
    </li>

    {#each data.poems as poem}
      <li class:active={poem.id === currentPoem.id} class="poem-list-item">
        <a
          class="sidebar-link"
          href={poemEditorPath(poem.id, poem.title)}
          onclick={(event) => {
            event.preventDefault();
            requestNavigation(poemEditorPath(poem.id, poem.title));
          }}
        >
          {poem.title}
        </a>
      </li>
    {/each}
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
  title="Poem saved"
  message={data.savedMessage ?? "Your changes were saved."}
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

  .poem-list-item,
  .nav-action-item {
    list-style: none;
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }

  .poem-list-item a,
  .nav-action-item a {
    display: inline-flex;
  }

  @media (max-width: 767.98px) {
    .edit-article {
      width: 100%;
      padding: 1.3333rem 1rem calc(var(--snh) + 2rem);
    }

    .edit-head {
      flex-direction: column;
    }

    .poem-list-item,
    .nav-action-item {
      padding: 0 1.5rem;
    }

    .nav-action-item:first-of-type {
      padding-top: 1rem;
    }

    .poem-list-item:last-of-type {
      padding-bottom: 2rem;
    }
  }
</style>
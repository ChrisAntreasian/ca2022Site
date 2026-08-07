<script lang="ts">
  import { page } from "$app/state";
  import Shell from "$lib/Article/Shell.svelte";
  import WebExperienceEditPane from "$lib/Article/WebExperienceEditPane.svelte";
  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";

  import { webExperienceEditorPath, type WebExperienceTarget } from "../editor";
  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  let currentTarget: WebExperienceTarget = $state(
    form && form.action === "save" && "values" in form && form.values
      ? (form.values as WebExperienceTarget)
      : data.target,
  );

  const baselineTarget = data.target;
  const dirty = $derived(
    JSON.stringify(currentTarget) !== JSON.stringify(baselineTarget),
  );

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

  const entryPath = (entryId: number, title: string) =>
    webExperienceEditorPath({ kind: "entry", id: entryId }, title);
</script>

<svelte:head>
  <title>Web Experience Editor</title>
</svelte:head>

<svelte:window onbeforeunload={handleBeforeUnload} />

<Shell
  activeTitle={currentTarget.title}
  defaultHeadline="Web Experience"
  wrapBasis={100}
>
  {#snippet mainContent()}
    <article class="edit-article">
      <div class="edit-head">
        <div>
          <h2>Web Experience Editor</h2>
          <p>
            Edit the intro block and the existing work entries while preserving
            linked logos and screenshots.
          </p>
        </div>
      </div>

      {#if form?.message}
        <p class="message">{form.message}</p>
      {/if}

      <WebExperienceEditPane
        bind:target={currentTarget}
        bind:formElement={saveAndContinueForm}
        saveLabel={currentTarget.kind === "entry" && currentTarget.id > 0
          ? "Save entry"
          : "Create entry"}
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
        + New experience
      </a>
    </li>

    <li class:active={currentTarget.kind === "intro"} class="nav-action-item">
      <a
        class="sidebar-link"
        href={data.editor.introPath}
        onclick={(event) => {
          event.preventDefault();
          requestNavigation(data.editor.introPath);
        }}
      >
        Intro
      </a>
    </li>

    {#each data.entries as entry}
      <li
        class:active={currentTarget.kind === "entry" &&
          currentTarget.id === entry.id}
        class="entry-list-item"
      >
        <a
          class="sidebar-link"
          href={entryPath(entry.id, entry.title)}
          onclick={(event) => {
            event.preventDefault();
            requestNavigation(entryPath(entry.id, entry.title));
          }}
        >
          {entry.title}
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
  title="Web experience saved"
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

  .entry-list-item,
  .nav-action-item {
    list-style: none;
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }

  .entry-list-item a,
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

    .entry-list-item,
    .nav-action-item {
      padding: 0 1.5rem;
    }

    .nav-action-item:first-of-type {
      padding-top: 1rem;
    }

    .entry-list-item:last-of-type {
      padding-bottom: 2rem;
    }
  }
</style>

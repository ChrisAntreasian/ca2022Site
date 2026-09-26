<script lang="ts">
  import EditorShell from "$lib/editing/core/EditorShell.svelte";
  import EditPane from "../_components/EditPane.svelte";
  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";
  import { cleanUrlSlug } from "$lib/history";
  import { webExperienceEditorPath } from "$lib/editing/resources/web-experience/web-experience-editor";
  import type { WebExperienceTarget } from "$lib/editing/resources/web-experience/web-experience";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const incomingTarget: WebExperienceTarget = $derived(
    form && form.action === "save" && "values" in form && form.values
      ? (form.values as WebExperienceTarget)
      : data.target,
  );
  let currentTarget: WebExperienceTarget = $state(data.target);

  $effect(() => {
    currentTarget = incomingTarget;
  });

  const baselineTarget = $derived(data.target);
  const dirty = $derived(
    JSON.stringify(currentTarget) !== JSON.stringify(baselineTarget),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
  let deleteSubmitElement: HTMLButtonElement | null = $state(null);
  let showDeleteConfirm = $state(false);

  const canDelete = $derived(
    currentTarget.kind === "entry" && currentTarget.id > 0,
  );

  const openDeleteConfirm = () => {
    if (!canDelete) return;
    showDeleteConfirm = true;
  };

  const cancelDelete = () => {
    showDeleteConfirm = false;
  };

  const confirmDelete = () => {
    showDeleteConfirm = false;
    deleteSubmitElement?.click();
  };

  const deleteTitle = $derived(
    currentTarget.kind === "entry" && currentTarget.title.trim()
      ? `Delete ${currentTarget.title}?`
      : "Delete this entry?",
  );

  const entryPath = (entryId: number, title: string) =>
    webExperienceEditorPath({ kind: "entry", id: entryId }, title);

  const viewHref = $derived(
    currentTarget.kind === "intro"
      ? "/web-experience"
      : currentTarget.id > 0
        ? `/web-experience/${currentTarget.id}/${cleanUrlSlug(currentTarget.title)}`
        : null,
  );
</script>

<svelte:head>
  <title>Web Experience Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentTarget.title}
  defaultHeadline="Web Experience"
  wrapBasis={100}
  editorTitle="Web Experience Editor"
  editorDescription="Edit the intro block and the existing work entries while preserving linked logos and screenshots."
  actionHref={viewHref}
  actionLabel="View post"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Web experience saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:target={currentTarget}
      bind:formElement={saveAndContinueForm}
      bind:deleteSubmitElement
      saveLabel={currentTarget.kind === "entry" && currentTarget.id > 0
        ? "Save entry"
        : "Create entry"}
      showDeleteButton={canDelete}
      onRequestDelete={openDeleteConfirm}
      submitFailed={form?.action === "save" && !!form?.message}
    />
  {/snippet}

  {#snippet navigationPane(requestNavigation)}
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
</EditorShell>

<UnsavedChangesDialog
  open={showDeleteConfirm}
  title={deleteTitle}
  message="This removes the entry from the live site. A history snapshot is retained so it can be restored later."
  stayLabel="Cancel"
  leaveLabel="Delete"
  onStay={cancelDelete}
  onLeave={confirmDelete}
/>

<style>
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

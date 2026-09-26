<script lang="ts">
  import EditorShell from "$lib/editing/core/EditorShell.svelte";
  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";
  import { cleanUrlSlug } from "$lib/history";
  import { quintuplapusEditorPath } from "$lib/editing/resources/quintuplapus/quintuplapus-editor";

  import EditPane from "../_components/EditPane.svelte";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const incomingCategoryTitle = $derived(
    form &&
      form.action === "save" &&
      "values" in form &&
      form.values?.categoryTitle
      ? form.values.categoryTitle
      : data.categoryTitle,
  );
  const incomingEntry = $derived(
    form && form.action === "save" && "values" in form && form.values?.id
      ? {
          ...data.selectedEntry,
          ...form.values,
        }
      : data.selectedEntry,
  );
  let currentCategoryTitle = $state(data.categoryTitle);
  let currentEntry = $state(data.selectedEntry);

  $effect(() => {
    currentCategoryTitle = incomingCategoryTitle;
    currentEntry = incomingEntry;
  });

  const baseline = $derived({
    categoryTitle: data.categoryTitle,
    entry: data.selectedEntry,
  });
  const dirty = $derived(
    JSON.stringify({
      categoryTitle: currentCategoryTitle,
      entry: currentEntry,
    }) !== JSON.stringify(baseline),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
  let deleteSubmitElement: HTMLButtonElement | null = $state(null);
  let showDeleteConfirm = $state(false);

  const canDelete = $derived(currentEntry.id > 0);

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
    currentEntry.title.trim()
      ? `Delete ${currentEntry.title}?`
      : "Delete this entry?",
  );

  const viewHref = $derived(
    currentEntry.id > 0
      ? `/the-quintuplapus/${currentEntry.id}/${cleanUrlSlug(currentEntry.title)}`
      : null,
  );
</script>

<svelte:head>
  <title>The Quintuplapus Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentEntry.title}
  defaultHeadline="the Quintuplapus"
  wrapBasis={100}
  editorTitle="The Quintuplapus Editor"
  editorDescription="Edit category title, entry metadata, markdown copy, ordering, and image assets."
  actionHref={viewHref}
  actionLabel="View post"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Quintuplapus entry saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:categoryTitle={currentCategoryTitle}
      bind:entry={currentEntry}
      bind:formElement={saveAndContinueForm}
      bind:deleteSubmitElement
      saveLabel="Save entry"
      showDeleteButton={canDelete}
      onRequestDelete={openDeleteConfirm}
      submitFailed={form?.action === "save" && !!form?.message}
    />
  {/snippet}

  {#snippet navigationPane(requestNavigation)}
    {#each data.entries as entry}
      <li class:active={entry.id === currentEntry.id} class="entry-list-item">
        <a
          class="sidebar-link"
          href={quintuplapusEditorPath(entry.id, entry.title)}
          onclick={(event) => {
            event.preventDefault();
            requestNavigation(quintuplapusEditorPath(entry.id, entry.title));
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
  .entry-list-item {
    list-style: none;
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }

  .entry-list-item a {
    display: inline-flex;
  }

  @media (max-width: 767.98px) {
    .entry-list-item {
      padding: 0 1.5rem;
    }

    .entry-list-item:first-of-type {
      padding-top: 1rem;
    }

    .entry-list-item:last-of-type {
      padding-bottom: 2rem;
    }
  }
</style>

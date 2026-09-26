<script lang="ts">
  import EditorShell from "$lib/editing/core/EditorShell.svelte";
  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";
  import { cleanUrlSlug } from "$lib/history";
  import { souljuicerEditorPath } from "$lib/editing/resources/souljuicer/souljuicer-editor";

  import EditPane from "../_components/EditPane.svelte";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const incomingEntry = $derived(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.selectedEntry,
  );
  let currentEntry = $state(data.selectedEntry);

  $effect(() => {
    currentEntry = incomingEntry;
  });

  const baselineEntry = $derived(data.selectedEntry);
  const dirty = $derived(
    JSON.stringify(currentEntry) !== JSON.stringify(baselineEntry),
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
      ? `/the-souljuicer/${currentEntry.id}/${cleanUrlSlug(currentEntry.title)}`
      : null,
  );
</script>

<svelte:head>
  <title>The SoulJuicer Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentEntry.title}
  defaultHeadline="the SoulJuicer"
  wrapBasis={100}
  editorTitle="The SoulJuicer Editor"
  editorDescription="Edit entry metadata, markdown copy, ordering, and image assets."
  actionHref={viewHref}
  actionLabel="View post"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Souljuicer entry saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
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
    {#each data.entries as entry, index}
      <li class:active={entry.id === currentEntry.id} class="entry-list-item">
        <a
          class="sidebar-link"
          href={souljuicerEditorPath(entry.id)}
          onclick={(event) => {
            event.preventDefault();
            requestNavigation(souljuicerEditorPath(entry.id));
          }}
        >
          {`Page ${index + 1}`}
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

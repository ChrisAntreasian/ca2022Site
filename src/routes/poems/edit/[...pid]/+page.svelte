<script lang="ts">
  import EditorShell from "$lib/editing/core/EditorShell.svelte";
  import UnsavedChangesDialog from "$lib/form/UnsavedChangesDialog.svelte";
  import { cleanUrlSlug } from "$lib/history";
  import EditPane from "../_components/EditPane.svelte";
  import { poemEditorPath } from "$lib/editing/resources/poems/poems-editor";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const incomingPoem = $derived(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.selectedPoem,
  );
  let currentPoem = $state(data.selectedPoem);

  $effect(() => {
    currentPoem = incomingPoem;
  });

  const baselinePoem = $derived(data.selectedPoem);
  const dirty = $derived(
    JSON.stringify(currentPoem) !== JSON.stringify(baselinePoem),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
  let deleteSubmitElement: HTMLButtonElement | null = $state(null);
  let showDeleteConfirm = $state(false);

  const canDelete = $derived(currentPoem.id > 0);

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
    currentPoem.title.trim()
      ? `Delete ${currentPoem.title}?`
      : "Delete this poem?",
  );

  const viewHref = $derived(
    currentPoem.id > 0
      ? `/poems/${currentPoem.id}/${cleanUrlSlug(currentPoem.title)}`
      : null,
  );
</script>

<svelte:head>
  <title>Poems Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentPoem.title}
  defaultHeadline="poetry"
  wrapBasis={70}
  editorTitle="Poems Editor"
  editorDescription="Edit the current poem in the article pane while keeping the existing poems navigation structure."
  actionHref={viewHref}
  actionLabel="View post"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Poem saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:poem={currentPoem}
      bind:formElement={saveAndContinueForm}
      bind:deleteSubmitElement
      saveLabel={currentPoem.id > 0 ? "Save poem" : "Create poem"}
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
</EditorShell>

<UnsavedChangesDialog
  open={showDeleteConfirm}
  title={deleteTitle}
  message="This removes the poem from the live site. A history snapshot is retained so it can be restored later."
  stayLabel="Cancel"
  leaveLabel="Delete"
  onStay={cancelDelete}
  onLeave={confirmDelete}
/>

<style>
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

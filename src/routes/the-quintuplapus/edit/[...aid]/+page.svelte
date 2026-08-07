<script lang="ts">
  import EditorShell from "$lib/editing/EditorShell.svelte";
  import { quintuplapusEditorPath } from "$lib/editing/quintuplapus-editor";

  import EditPane from "../_components/EditPane.svelte";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  let currentCategoryTitle = $state(
    form && form.action === "save" && "values" in form && form.values?.categoryTitle
      ? form.values.categoryTitle
      : data.categoryTitle,
  );
  let currentEntry = $state(
    form && form.action === "save" && "values" in form && form.values?.id
      ? {
          ...data.selectedEntry,
          ...form.values,
        }
      : data.selectedEntry,
  );

  const baseline = {
    categoryTitle: data.categoryTitle,
    entry: data.selectedEntry,
  };
  const dirty = $derived(
    JSON.stringify({
      categoryTitle: currentCategoryTitle,
      entry: currentEntry,
    }) !== JSON.stringify(baseline),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
</script>

<svelte:head>
  <title>The Quintuplapus Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentEntry.title}
  defaultHeadline="the Quintuplapus"
  wrapBasis={100}
  editorTitle="The Quintuplapus Editor"
  editorDescription="Edit category metadata, scene metadata, and image assets."
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle="Quintuplapus entry saved"
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:categoryTitle={currentCategoryTitle}
      bind:entry={currentEntry}
      bind:formElement={saveAndContinueForm}
      saveLabel="Save entry"
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
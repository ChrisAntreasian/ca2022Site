<script lang="ts">
  import EditorShell from "$lib/editing/EditorShell.svelte";
  import { souljuicerEditorPath } from "$lib/editing/souljuicer-editor";

  import EditPane from "../_components/EditPane.svelte";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  let currentEntry = $state(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.selectedEntry,
  );

  const baselineEntry = data.selectedEntry;
  const dirty = $derived(
    JSON.stringify(currentEntry) !== JSON.stringify(baselineEntry),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
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
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle="Souljuicer entry saved"
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:entry={currentEntry}
      bind:formElement={saveAndContinueForm}
      saveLabel="Save entry"
      submitFailed={form?.action === "save" && !!form?.message}
    />
  {/snippet}

  {#snippet navigationPane(requestNavigation)}
    {#each data.entries as entry}
      <li class:active={entry.id === currentEntry.id} class="entry-list-item">
        <a
          class="sidebar-link"
          href={souljuicerEditorPath(entry.id)}
          onclick={(event) => {
            event.preventDefault();
            requestNavigation(souljuicerEditorPath(entry.id));
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
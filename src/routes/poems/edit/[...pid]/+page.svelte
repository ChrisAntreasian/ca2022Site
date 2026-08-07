<script lang="ts">
  import EditorShell from "$lib/editing/EditorShell.svelte";
  import EditPane from "../_components/EditPane.svelte";
  import { poemEditorPath } from "$lib/editing/poems-editor";

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
  const dirty = $derived(
    JSON.stringify(currentPoem) !== JSON.stringify(baselinePoem),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
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
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle="Poem saved"
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:poem={currentPoem}
      bind:formElement={saveAndContinueForm}
      saveLabel={currentPoem.id > 0 ? "Save poem" : "Create poem"}
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

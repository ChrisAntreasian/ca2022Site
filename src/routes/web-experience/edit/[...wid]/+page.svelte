<script lang="ts">
  import EditorShell from "$lib/editing/EditorShell.svelte";
  import EditPane from "../_components/EditPane.svelte";
  import { webExperienceEditorPath } from "$lib/editing/web-experience-editor";
  import type { WebExperienceTarget } from "$lib/editing/web-experience";

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

  let saveAndContinueForm: HTMLFormElement | null = $state(null);

  const entryPath = (entryId: number, title: string) =>
    webExperienceEditorPath({ kind: "entry", id: entryId }, title);
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
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle="Web experience saved"
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:target={currentTarget}
      bind:formElement={saveAndContinueForm}
      saveLabel={currentTarget.kind === "entry" && currentTarget.id > 0
        ? "Save entry"
        : "Create entry"}
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

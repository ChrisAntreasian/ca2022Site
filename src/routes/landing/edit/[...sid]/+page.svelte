<script lang="ts">
  import EditorShell from "#lib/editing/core/EditorShell.svelte";
  import EditPane from "../_components/EditPane.svelte";
  import { landingEditorPath } from "#lib/editing/resources/landing/landing-editor";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const incomingSection = $derived(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.selectedSection,
  );
  let currentSection = $state((() => data.selectedSection)());

  $effect(() => {
    currentSection = incomingSection;
  });

  const baselineSection = $derived(data.selectedSection);
  const dirty = $derived(
    JSON.stringify(currentSection) !== JSON.stringify(baselineSection),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
</script>

<svelte:head>
  <title>Home Page Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentSection.title}
  defaultHeadline="home"
  wrapBasis={70}
  editorTitle="Home Page Editor"
  editorDescription="Edit each home page section. Sections keep their images; only the title, body and link change."
  actionHref="/"
  actionLabel="View site"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Section saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:section={currentSection}
      bind:formElement={saveAndContinueForm}
      saveLabel="Save section"
      submitFailed={form?.action === "save" && !!form?.message}
    />
  {/snippet}

  {#snippet navigationPane(requestNavigation)}
    {#each data.landing.sections as section}
      <li
        class:active={section.id === currentSection.id}
        class="section-list-item"
      >
        <a
          class="sidebar-link"
          href={landingEditorPath(section.id)}
          onclick={(event) => {
            event.preventDefault();
            requestNavigation(landingEditorPath(section.id));
          }}
        >
          {section.title}
        </a>
      </li>
    {/each}
  {/snippet}
</EditorShell>

<style>
  .section-list-item {
    list-style: none;
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }

  .section-list-item a {
    display: inline-flex;
  }

  @media (max-width: 767.98px) {
    .section-list-item {
      padding: 0 1.5rem;
    }
  }
</style>

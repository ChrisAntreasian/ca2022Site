<script lang="ts">
  import EditorShell from "#lib/editing/core/EditorShell.svelte";
  import EditPane from "./_components/EditPane.svelte";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const incomingLayout = $derived(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.layout,
  );
  let currentLayout = $state((() => data.layout)());

  $effect(() => {
    currentLayout = incomingLayout;
  });

  const baselineLayout = $derived(data.layout);
  const dirty = $derived(
    JSON.stringify(currentLayout) !== JSON.stringify(baselineLayout),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
</script>

<svelte:head>
  <title>Site Layout Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentLayout.title}
  defaultHeadline="layout"
  wrapBasis={70}
  editorTitle="Site Layout Editor"
  editorDescription="Edit the header title and logo used across every page."
  actionHref="/"
  actionLabel="View site"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Layout saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:layout={currentLayout}
      bind:formElement={saveAndContinueForm}
      saveLabel="Save layout"
      submitFailed={form?.action === "save" && !!form?.message}
    />
  {/snippet}

  {#snippet navigationPane()}
    <li class="layout-nav-item active">
      <a class="sidebar-link" href="/layout/edit">Site Layout</a>
    </li>
  {/snippet}
</EditorShell>

<style>
  .layout-nav-item {
    list-style: none;
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }

  .layout-nav-item a {
    display: inline-flex;
  }

  @media (max-width: 767.98px) {
    .layout-nav-item {
      padding: 0 1.5rem;
    }
  }
</style>

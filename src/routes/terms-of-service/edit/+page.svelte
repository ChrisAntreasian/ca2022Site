<script lang="ts">
  import EditorShell from "#lib/editing/core/EditorShell.svelte";
  import HistoryDialog from "#lib/editing/HistoryDialog.svelte";
  import EditPane from "./_components/EditPane.svelte";

  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  let currentTerms = $state({ title: "", bodyMarkdown: "" });

  $effect(() => {
    currentTerms = {
      ...(form && form.action === "save" && "values" in form && form.values
        ? form.values
        : data.terms),
    };
  });

  const baselineTerms = $derived(data.terms);
  const dirty = $derived(
    JSON.stringify(currentTerms) !== JSON.stringify(baselineTerms),
  );

  let saveAndContinueForm: HTMLFormElement | null = $state(null);
</script>

<svelte:head>
  <title>Terms of Service Editor</title>
</svelte:head>

<EditorShell
  activeTitle={currentTerms.title}
  defaultHeadline="terms"
  wrapBasis={70}
  editorTitle="Terms of Service Editor"
  editorDescription="Edit the title and markdown body used on the terms-of-service page. Restoring a saved version replaces title and body at once - see Restore the whole terms of service."
  actionHref="/terms-of-service"
  actionLabel="View post"
  formMessage={form?.message}
  savedMessage={data.savedMessage}
  savedTitle={data.savedTitle ?? "Terms of service saved"}
  isDirty={dirty}
  bind:formElement={saveAndContinueForm}
>
  {#snippet editorPane()}
    <EditPane
      bind:terms={currentTerms}
      bind:formElement={saveAndContinueForm}
      saveLabel="Save terms"
      submitFailed={form?.action === "save" && !!form?.message}
    />
  {/snippet}

  {#snippet navigationPane(requestNavigation)}
    <li class="terms-nav-item">
      <a
        class="sidebar-link"
        href={data.restore.href}
        onclick={(event) => {
          event.preventDefault();
          requestNavigation(data.restore.href);
        }}
      >
        Restore the whole terms of service
      </a>
    </li>

    <li class="terms-nav-item active">
      <a
        class="sidebar-link"
        href="/terms-of-service/edit"
        onclick={(event) => {
          event.preventDefault();
          requestNavigation("/terms-of-service/edit");
        }}
      >
        Terms of Service
      </a>
    </li>
  {/snippet}
</EditorShell>

<HistoryDialog
  open={data.restore.open}
  versions={data.restore.versions}
  target={null}
  record={data.restore.record}
  wholeRecordNoun="terms of service"
  note={data.restore.note}
  actionHref={data.restore.actionHref}
  versionsHref={data.restore.versionsHref}
  closeHref={data.restore.closeHref}
  draftVersion={data.restore.draftVersion}
/>

<style>
  .terms-nav-item {
    list-style: none;
    margin-bottom: 1rem;
    font-family: "josefin-bold";
  }

  .terms-nav-item a {
    display: inline-flex;
  }

  @media (max-width: 767.98px) {
    .terms-nav-item {
      padding: 1rem 1.5rem 2rem;
    }
  }
</style>

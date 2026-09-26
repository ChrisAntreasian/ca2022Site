<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import TextInput from "$lib/form/TextInput.svelte";

  import type { TermsOfServiceEditorValue } from "$lib/editing/resources/terms-of-service/terms-of-service";

  interface Props {
    terms: TermsOfServiceEditorValue;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    submitFailed?: boolean;
  }

  let {
    terms = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    submitFailed = false,
  }: Props = $props();

  const titleError = $derived(
    submitFailed && !terms.title.trim() ? "Title is required." : undefined,
  );
  const bodyError = $derived(
    submitFailed && !terms.bodyMarkdown.trim()
      ? "Body is required."
      : undefined,
  );
</script>

<form bind:this={formElement} class="terms-form" method="POST" action="?/save">
  <input name="redirectTo" type="hidden" value="" />

  <TextInput
    id="title"
    name="title"
    label="Title"
    bind:value={terms.title}
    placeholder="Terms page title"
    required
    error={titleError}
  />

  <MarkdownEditor
    id="bodyMarkdown"
    name="bodyMarkdown"
    label="Body"
    bind:value={terms.bodyMarkdown}
    placeholder="Write the terms in markdown"
    required
    rows={18}
    error={bodyError}
  />

  <div class="actions">
    <Button type="submit">{saveLabel}</Button>
  </div>
</form>

<style>
  .terms-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>

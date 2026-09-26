<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";

  import type { PoemEditorValue } from "$lib/editing/poems";

  interface Props {
    poem: PoemEditorValue;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    deleteSubmitElement?: HTMLButtonElement | null;
    showDeleteButton?: boolean;
    onRequestDelete?: () => void;
    submitFailed?: boolean;
  }

  let {
    poem = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    deleteSubmitElement = $bindable(null),
    showDeleteButton = false,
    onRequestDelete,
    submitFailed = false,
  }: Props = $props();

  const titleError = $derived(
    submitFailed && !poem.title.trim() ? "Title is required." : undefined,
  );
  const bodyError = $derived(
    submitFailed && !poem.bodyMarkdown.trim() ? "Body is required." : undefined,
  );
  const sortOrderError = $derived(
    submitFailed && Number.isNaN(poem.sortOrder) ? "Sort order must be a number." : undefined,
  );
</script>

<form bind:this={formElement} class="poem-form" method="POST" action="?/save">
  <input name="id" type="hidden" value={poem.id} />
  <input name="redirectTo" type="hidden" value="" />

  <TextInput
    id="title"
    name="title"
    label="Title"
    bind:value={poem.title}
    placeholder="Poem title"
    required
    error={titleError}
  />

  <NumberInput
    id="sortOrder"
    name="sortOrder"
    label="Sort Order"
    bind:value={poem.sortOrder}
    description="Lower numbers appear earlier in the poem list."
    required
    error={sortOrderError}
  />

  <MarkdownEditor
    id="bodyMarkdown"
    name="bodyMarkdown"
    label="Body"
    bind:value={poem.bodyMarkdown}
    placeholder="Write the poem body in markdown"
    required
    rows={20}
    error={bodyError}
  />

  <div class="actions">
    {#if showDeleteButton}
      <Button type="button" variant="warning" onclick={onRequestDelete}>Delete poem</Button>
    {/if}
    <Button type="submit">{saveLabel}</Button>
    <button
      type="submit"
      formaction="?/delete"
      class="hidden-submit"
      bind:this={deleteSubmitElement}
    >
      Delete
    </button>
  </div>
</form>

<style>
  .poem-form {
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

  .hidden-submit {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>
<script lang="ts">
  import Button from "#lib/form/Button.svelte";
  import MarkdownEditor from "#lib/form/MarkdownEditor.svelte";
  import NumberInput from "#lib/form/NumberInput.svelte";
  import TextInput from "#lib/form/TextInput.svelte";

  import type { PoemEditorValue } from "#lib/editing/resources/poems/poems";

  interface Props {
    poem: PoemEditorValue;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    deleteSubmitElement?: HTMLButtonElement | null;
    showDeleteButton?: boolean;
    onRequestDelete?: () => void;
    submitFailed?: boolean;
    /** Whether a release control should appear. False while live content is still bundled. */
    showReleaseButton?: boolean;
  }

  let {
    poem = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    deleteSubmitElement = $bindable(null),
    showDeleteButton = false,
    onRequestDelete,
    submitFailed = false,
    showReleaseButton = false,
  }: Props = $props();

  const titleError = $derived(
    submitFailed && !poem.title.trim() ? "Title is required." : undefined,
  );
  const bodyError = $derived(
    submitFailed && !poem.bodyMarkdown.trim() ? "Body is required." : undefined,
  );
  const sortOrderError = $derived(
    submitFailed && Number.isNaN(poem.sortOrder)
      ? "Sort order must be a number."
      : undefined,
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
      <Button type="button" variant="warning" onclick={onRequestDelete}
        >Delete poem</Button
      >
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

{#if showReleaseButton}
  <!--
    A release publishes the whole draft, not the poem being edited, so it is a separate form rather than
    another formaction on the poem form. Nesting it inside would be invalid HTML and would submit the
    poem's fields to an action that does not read them.
  -->
  <form class="release-form" method="POST" action="?/release">
    <p class="release-note">
      Publishing sends the entire working draft to the live site. The copy
      visitors were seeing is kept in history so this release can be undone.
    </p>
    <Button type="submit" variant="action">Release poems to live</Button>
  </form>
{/if}

<style>
  .poem-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .release-form {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid currentColor;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .release-note {
    font-family: "josefin-regular";
    margin: 0;
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

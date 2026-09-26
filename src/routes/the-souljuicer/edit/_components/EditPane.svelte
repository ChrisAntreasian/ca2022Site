<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import ImageUploadSection from "$lib/form/ImageUploadSection.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";

  import type { SouljuicerEditorEntry } from "$lib/editing/resources/souljuicer/souljuicer";

  interface Props {
    entry: SouljuicerEditorEntry;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    deleteSubmitElement?: HTMLButtonElement | null;
    showDeleteButton?: boolean;
    onRequestDelete?: () => void;
    submitFailed?: boolean;
  }

  let {
    entry = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    deleteSubmitElement = $bindable(null),
    showDeleteButton = false,
    onRequestDelete,
    submitFailed = false,
  }: Props = $props();

  const titleError = $derived(
    submitFailed && !entry.title.trim() ? "Title is required." : undefined,
  );
  const createdDateError = $derived(
    submitFailed && !entry.createdDate.trim()
      ? "Created date is required."
      : undefined,
  );
  const mediumError = $derived(
    submitFailed && !entry.medium.trim() ? "Medium is required." : undefined,
  );
  const sortOrderError = $derived(
    submitFailed && Number.isNaN(entry.sortOrder)
      ? "Sort order must be a number."
      : undefined,
  );
  const descriptionError = $derived(
    submitFailed && !entry.description.trim()
      ? "Description is required."
      : undefined,
  );
</script>

<form
  bind:this={formElement}
  class="editor-form"
  method="POST"
  action="?/save"
  enctype="multipart/form-data"
>
  <input name="id" type="hidden" value={entry.id} />
  <input name="redirectTo" type="hidden" value="" />

  <section class="form-section" aria-label="Scene metadata">
    <TextInput
      id="title"
      name="title"
      label="Title"
      bind:value={entry.title}
      placeholder="the SoulJuicer"
      required
      error={titleError}
    />

    <TextInput
      id="createdDate"
      name="createdDate"
      label="Created Date"
      bind:value={entry.createdDate}
      placeholder="2023-01-10"
      required
      error={createdDateError}
    />

    <TextInput
      id="medium"
      name="medium"
      label="Medium"
      bind:value={entry.medium}
      placeholder="pencil"
      required
      error={mediumError}
    />

    <NumberInput
      id="sortOrder"
      name="sortOrder"
      label="Sort Order"
      bind:value={entry.sortOrder}
      description="Lower numbers appear earlier in the sequence."
      required
      error={sortOrderError}
    />
  </section>

  <section class="form-section" aria-label="Scene description">
    <MarkdownEditor
      id="description"
      name="description"
      label="Description"
      bind:value={entry.description}
      placeholder="Write the scene description"
      required
      rows={16}
      error={descriptionError}
    />
  </section>

  <section class="form-section" aria-label="Scene image">
    <ImageUploadSection
      sectionTitle="Scene Image"
      uploadInputId="imageFile"
      uploadInputName="imageFile"
      uploadDescription="Upload a new image to replace the current scene image."
      singleImage={entry.imageUrl
        ? {
            url: entry.imageUrl,
            alt: `Souljuicer scene ${entry.id}`,
          }
        : null}
    />
  </section>

  <div class="actions">
    {#if showDeleteButton}
      <Button type="button" variant="warning" onclick={onRequestDelete}
        >Delete entry</Button
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

<style>
  .editor-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-section {
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

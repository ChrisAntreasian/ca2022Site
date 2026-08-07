<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import ImageUploadSection from "$lib/form/ImageUploadSection.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";

  import type { QuintuplapusEditorEntry } from "$lib/editing/quintuplapus";

  interface Props {
    categoryTitle: string;
    entry: QuintuplapusEditorEntry;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
  }

  let {
    categoryTitle = $bindable(),
    entry = $bindable(),
    saveLabel,
    formElement = $bindable(null),
  }: Props = $props();
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

  <section class="form-section" aria-label="Category and entry metadata">
    <TextInput
      id="categoryTitle"
      name="categoryTitle"
      label="Category Title"
      bind:value={categoryTitle}
      placeholder="The Quintuplapus"
      required
    />

    <TextInput
      id="title"
      name="title"
      label="Entry Title"
      bind:value={entry.title}
      placeholder="Entry title"
      required
    />

    <TextInput
      id="createdDate"
      name="createdDate"
      label="Created Date"
      bind:value={entry.createdDate}
      placeholder="YYYY-MM-DD"
      required
    />

    <TextInput
      id="medium"
      name="medium"
      label="Medium"
      bind:value={entry.medium}
      placeholder="water color, color pencil"
      required
    />

    <NumberInput
      id="sortOrder"
      name="sortOrder"
      label="Sort Order"
      bind:value={entry.sortOrder}
      description="Lower numbers appear earlier in the sequence."
      required
    />
  </section>

  <section class="form-section" aria-label="Entry description">
    <MarkdownEditor
      id="description"
      name="description"
      label="Description"
      bind:value={entry.description}
      description="Entry narrative in markdown format."
      placeholder="Write the entry description"
      required
      rows={16}
    />
  </section>

  <section class="form-section" aria-label="Entry image">
    <ImageUploadSection
      sectionTitle="Entry Image"
      uploadInputId="imageFile"
      uploadInputName="imageFile"
      uploadLabel="Replace Image"
      uploadDescription="Upload a new image to replace the current entry image."
    >
      {#snippet preview()}
        {#if entry.imageUrl}
          <div class="media-preview-card">
            <img
              class="media-preview-image"
              src={entry.imageUrl}
              alt={entry.title}
            />
            <p class="media-preview-caption">Current entry image</p>
          </div>
        {:else}
          <p class="media-preview-empty">No image uploaded for this entry yet.</p>
        {/if}
      {/snippet}
    </ImageUploadSection>
  </section>

  <div class="actions">
    <Button type="submit">{saveLabel}</Button>
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
  }

  .media-preview-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .media-preview-image {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border: 1px solid var(--w-dk);
    background: var(--w-xl);
  }

  .media-preview-caption,
  .media-preview-empty {
    margin: 0;
    font-size: 0.9rem;
    color: var(--w-md);
  }

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>
<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import ImageUploadSection from "$lib/form/ImageUploadSection.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";

  import type { SouljuicerEditorEntry } from "$lib/editing/souljuicer";

  interface Props {
    entry: SouljuicerEditorEntry;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
  }

  let {
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

  <TextInput
    id="title"
    name="title"
    label="Title"
    bind:value={entry.title}
    placeholder="the SoulJuicer"
    required
  />

  <TextInput
    id="createdDate"
    name="createdDate"
    label="Created Date"
    bind:value={entry.createdDate}
    placeholder="2023-01-10"
    required
  />

  <TextInput
    id="medium"
    name="medium"
    label="Medium"
    bind:value={entry.medium}
    placeholder="pencil"
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

  <MarkdownEditor
    id="description"
    name="description"
    label="Description"
    bind:value={entry.description}
    description="Scene copy in markdown format."
    placeholder="Write the scene description"
    required
    rows={16}
  />

  <ImageUploadSection
    sectionTitle="Scene Image"
    uploadInputId="imageFile"
    uploadInputName="imageFile"
    uploadLabel="Replace Image"
    uploadDescription="Upload a new image to replace the current scene image."
  >
    {#snippet preview()}
      {#if entry.imageUrl}
        <div class="media-preview-card">
          <img
            class="media-preview-image"
            src={entry.imageUrl}
            alt={`Souljuicer scene ${entry.id}`}
          />
        </div>
      {/if}
    {/snippet}
  </ImageUploadSection>

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

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>
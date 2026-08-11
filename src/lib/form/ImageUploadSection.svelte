<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    sectionTitle: string;
    uploadInputId: string;
    uploadInputName: string;
    uploadLabel: string;
    uploadDescription: string;
    accept?: string;
    multiple?: boolean;
    preview?: Snippet;
  }

  let {
    sectionTitle,
    uploadInputId,
    uploadInputName,
    uploadLabel,
    uploadDescription,
    accept = "image/*",
    multiple = false,
    preview,
  }: Props = $props();
</script>

<div class="media-section">
  <div class="form-field__label">{sectionTitle}</div>

  {@render preview?.()}

  <label class="upload-field" for={uploadInputId}>
    <span class="upload-label">{uploadLabel}</span>
    <input
      id={uploadInputId}
      name={uploadInputName}
      type="file"
      {accept}
      {multiple}
    />
  </label>
</div>

<style>
  .upload-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .upload-label {
    font-family: var(--font-th);
    letter-spacing: 0.08rem;
    font-size: 1.25rem;
  }

  .media-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
  }
</style>

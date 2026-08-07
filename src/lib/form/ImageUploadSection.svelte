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
  <div class="media-section-head">{sectionTitle}</div>

  {@render preview?.()}

  <label class="upload-field" for={uploadInputId}>
    <span class="upload-label">{uploadLabel}</span>
    <span class="upload-description">{uploadDescription}</span>
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

  .upload-description {
    font-size: 0.95rem;
    line-height: 1.25rem;
    color: var(--b-dk);
  }

  .media-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--w-dk);
    background: color-mix(in srgb, var(--w-xl) 86%, transparent);
  }

  .media-section-head {
    font-family: var(--font-th);
    letter-spacing: 0.08rem;
    font-size: 1.15rem;
  }
</style>
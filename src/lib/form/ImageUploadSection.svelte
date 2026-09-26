<script lang="ts">
  import Button from "./Button.svelte";

  type SingleImage = {
    url: string;
    alt: string;
    removeFieldName?: string;
  };

  type GalleryImage = {
    id: number | string;
    url: string;
    alt: string;
  };

  interface Props {
    sectionTitle: string;
    uploadInputId: string;
    uploadInputName: string;
    uploadDescription: string;
    accept?: string;
    multiple?: boolean;
    singleImage?: SingleImage | null;
    galleryImages?: ReadonlyArray<GalleryImage>;
    removeFieldName?: string;
  }

  let {
    sectionTitle,
    uploadInputId,
    uploadInputName,
    uploadDescription: _uploadDescription,
    accept = "image/*",
    multiple = false,
    singleImage = null,
    galleryImages = [],
    removeFieldName,
  }: Props = $props();

  let uploadInput = $state<HTMLInputElement | null>(null);
  let stagedFiles = $state<ReadonlyArray<File>>([]);
  let stagedMedia = $state<
    ReadonlyArray<{ name: string; url: string; alt: string }>
  >([]);
  let removedSingle = $state(false);
  let removedGalleryIds = $state<ReadonlyArray<string>>([]);

  $effect(() => {
    const nextMedia = stagedFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      alt: file.name,
    }));

    stagedMedia = nextMedia;

    return () => {
      nextMedia.forEach((media) => URL.revokeObjectURL(media.url));
    };
  });

  const galleryItems = $derived.by(() => {
    if (!multiple) {
      return [] as Array<GalleryImage & { removed: boolean }>;
    }

    const removed = new Set(removedGalleryIds);
    return galleryImages.map((image) => ({
      ...image,
      removed: removed.has(String(image.id)),
    }));
  });

  const hasSinglePreview = $derived.by(
    () => stagedMedia.length > 0 || (!!singleImage && !removedSingle),
  );

  const actionLabel = $derived.by(() => {
    if (multiple) {
      return "Add";
    }

    return hasSinglePreview ? "Replace" : "Upload";
  });

  const showAddUploadButton = $derived.by(() => {
    if (multiple) {
      return true;
    }

    return !singleImage || removedSingle;
  });

  const showInlineReplaceLink = $derived.by(
    () => !multiple && !!singleImage && !removedSingle,
  );

  const singleRemovedName = $derived.by(() =>
    singleImage ? fileNameFromUrl(singleImage.url) : "image",
  );

  const singleFileName = $derived.by(() => {
    if (stagedMedia.length > 0) {
      return stagedMedia[0].name;
    }

    if (singleImage) {
      return fileNameFromUrl(singleImage.url);
    }

    return "";
  });

  const canShowSingleRemove = $derived.by(() => {
    if (stagedMedia.length > 0) {
      return true;
    }

    return !!singleImage?.removeFieldName && !removedSingle;
  });

  const showMediaColumn = $derived.by(() =>
    multiple
      ? galleryItems.length > 0 || stagedMedia.length > 0
      : hasSinglePreview || removedSingle,
  );

  const singlePreviewState = $derived.by(() => {
    if (stagedMedia.length > 0) {
      return "staged" as const;
    }

    if (removedSingle) {
      return "removed" as const;
    }

    return "idle" as const;
  });

  const openPicker = () => {
    uploadInput?.click();
  };

  const syncInputFiles = (files: ReadonlyArray<File>) => {
    if (!uploadInput) {
      return;
    }

    if (files.length === 0) {
      uploadInput.value = "";
      return;
    }

    const transfer = new DataTransfer();

    files.forEach((file) => {
      transfer.items.add(file);
    });

    uploadInput.files = transfer.files;
  };

  const onInputChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    if (multiple) {
      const nextFiles = [...stagedFiles, ...files];

      stagedFiles = nextFiles;
      syncInputFiles(nextFiles);
      return;
    }

    stagedFiles = files.slice(0, 1);
    syncInputFiles(stagedFiles);

    if (stagedFiles.length > 0) {
      removedSingle = false;
    }
  };

  const removeSingleImage = () => {
    if (!singleImage?.removeFieldName) {
      return;
    }

    stagedFiles = [];

    if (uploadInput) {
      uploadInput.value = "";
    }

    removedSingle = true;
  };

  const removeGalleryImage = (id: number | string) => {
    const nextId = String(id);

    if (removedGalleryIds.includes(nextId)) {
      return;
    }

    removedGalleryIds = [...removedGalleryIds, nextId];
  };

  const clearSingleSelection = () => {
    if (stagedFiles.length > 0) {
      stagedFiles = [];

      if (uploadInput) {
        uploadInput.value = "";
      }

      return;
    }

    removeSingleImage();
  };

  const removeStagedGalleryImage = (index: number) => {
    const next = stagedFiles.filter(
      (_, candidateIndex) => candidateIndex !== index,
    );

    stagedFiles = next;
    syncInputFiles(next);
  };

  function fileNameFromUrl(url: string) {
    try {
      const parsed = new URL(url, "https://example.invalid");
      const tail = parsed.pathname.split("/").filter(Boolean).pop();

      return tail ? decodeURIComponent(tail) : "image";
    } catch {
      return "image";
    }
  }
</script>

<div class="media-section">
  <div class="form-field__label">{sectionTitle}</div>

  <div class="upload-shell form-control">
    {#if !showInlineReplaceLink}
      <div class="control-row">
        {#if showAddUploadButton}
          <Button type="button" onclick={openPicker}>{actionLabel}</Button>
        {/if}
      </div>
    {/if}

    {#if showMediaColumn}
      <div class="media-column">
        {#if multiple}
          {#each galleryItems as image (image.id)}
            <div class="media-card" data-kind="existing">
              <div class="media-meta">
                <span class="selected-file">{fileNameFromUrl(image.url)}</span>
                {#if !image.removed}
                  <button
                    type="button"
                    class="action-link remove-link"
                    aria-label={`Remove ${fileNameFromUrl(image.url)}`}
                    onclick={() => removeGalleryImage(image.id)}
                  >
                    Remove
                  </button>
                {/if}
              </div>
              <div class="media-thumb-wrap">
                <img
                  class="media-thumb"
                  class:is-removed={image.removed}
                  src={image.url}
                  alt={image.alt}
                />
              </div>
            </div>
          {/each}

          {#each stagedMedia as media, index (media.url)}
            <div class="media-card" data-kind="staged">
              <div class="media-meta">
                <span class="selected-file">{media.name}</span>
                <button
                  type="button"
                  class="action-link remove-link"
                  aria-label={`Remove ${media.name}`}
                  onclick={() => removeStagedGalleryImage(index)}
                >
                  Remove
                </button>
              </div>
              <div class="media-thumb-wrap">
                <img
                  class="media-thumb is-staged"
                  src={media.url}
                  alt={media.alt}
                />
              </div>
            </div>
          {/each}
        {:else if stagedMedia.length > 0}
          <div class="media-card" data-kind="staged">
            <div class="media-meta">
              <span class="selected-file">{singleFileName}</span>
              {#if showInlineReplaceLink}
                <button
                  type="button"
                  class="action-link replace-link"
                  onclick={openPicker}
                >
                  Replace
                </button>
              {/if}
              <button
                type="button"
                class="action-link remove-link"
                onclick={clearSingleSelection}
              >
                Remove
              </button>
            </div>
            <div class="media-thumb-wrap">
              <img
                class="media-thumb"
                class:is-staged={singlePreviewState === "staged"}
                src={stagedMedia[0].url}
                alt={stagedMedia[0].alt}
              />
            </div>
          </div>
        {:else if singleImage && !removedSingle}
          <div class="media-card" data-kind="existing">
            <div class="media-meta">
              <span class="selected-file">{singleFileName}</span>
              {#if showInlineReplaceLink}
                <button
                  type="button"
                  class="action-link replace-link"
                  onclick={openPicker}
                >
                  Replace
                </button>
              {/if}
              {#if canShowSingleRemove}
                <button
                  type="button"
                  class="action-link remove-link"
                  onclick={clearSingleSelection}
                >
                  Remove
                </button>
              {/if}
            </div>
            <div class="media-thumb-wrap">
              <img
                class="media-thumb"
                src={singleImage.url}
                alt={singleImage.alt}
              />
            </div>
          </div>
        {:else if removedSingle}
          <div class="media-card" data-kind="removed">
            <div class="media-meta">
              <span class="selected-file">{singleRemovedName}</span>
            </div>
            <div class="media-thumb-wrap">
              <img
                class="media-thumb is-removed"
                src={singleImage?.url}
                alt={singleImage?.alt ?? singleRemovedName}
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <input
      id={uploadInputId}
      name={uploadInputName}
      type="file"
      {accept}
      {multiple}
      class="native-file-input"
      bind:this={uploadInput}
      onchange={onInputChange}
    />

    {#if singleImage?.removeFieldName && removedSingle}
      <input type="hidden" name={singleImage.removeFieldName} value="1" />
    {/if}

    {#if removeFieldName}
      {#each removedGalleryIds as removedId (removedId)}
        <input type="hidden" name={removeFieldName} value={removedId} />
      {/each}
    {/if}
  </div>
</div>

<style>
  @import "./field.css";

  .media-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .upload-shell {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .control-row {
    display: flex;
    align-items: flex-start;
    width: 100%;
    padding-bottom: 0.65rem;
    border-bottom: 0.0625rem solid var(--b-md);
  }

  .selected-file {
    color: var(--b-dk);
    font-size: 0.9rem;
    line-height: 1.1rem;
    word-break: break-word;
  }

  .native-file-input {
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

  .media-column {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    width: 100%;
  }

  .media-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem);
    column-gap: 1rem;
    align-items: start;
    gap: 0.35rem;
  }

  .media-card + .media-card {
    border-top: 0.0625rem solid var(--b-md);
    padding-top: 0.65rem;
  }

  .media-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    padding-top: 0.1rem;
  }

  .media-thumb-wrap {
    width: 16rem;
    max-width: 100%;
  }

  .media-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 8rem;
    object-fit: cover;
    border: 0.1875rem solid transparent;
    box-sizing: border-box;
    background: var(--w-xl);
  }

  .media-thumb.is-staged {
    border-color: var(--b-lt);
  }

  .media-thumb.is-removed {
    border-color: var(--o-md);
  }

  .action-link {
    all: unset;
    font-size: 0.9rem;
    line-height: 1.1rem;
    text-decoration: underline;
    cursor: pointer;
  }

  .remove-link {
    color: var(--p-dk);
  }

  .remove-link:hover {
    color: var(--p-md);
  }

  .replace-link {
    color: var(--b-md);
  }

  .replace-link:hover {
    color: var(--b-dk);
  }

  .action-link:focus-visible {
    outline: 0.125rem solid var(--b-md);
    outline-offset: 0.125rem;
  }

  .native-file-input,
  .action-link {
    border: 0;
  }

  @media (max-width: 860px) {
    .media-card {
      grid-template-columns: minmax(0, 1fr) minmax(9rem, 12rem);
      column-gap: 0.75rem;
    }
  }
</style>

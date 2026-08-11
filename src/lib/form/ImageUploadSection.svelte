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
    uploadDescription,
    accept = "image/*",
    multiple = false,
    singleImage = null,
    galleryImages = [],
    removeFieldName,
  }: Props = $props();

  let uploadInput = $state<HTMLInputElement | null>(null);
  let stagedFiles = $state<ReadonlyArray<File>>([]);
  let stagedMedia = $state<ReadonlyArray<{ name: string; url: string; alt: string }>>([]);
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

  const visibleGallery = $derived.by(() => {
    if (!multiple) {
      return [] as Array<GalleryImage>;
    }

    const removed = new Set(removedGalleryIds);
    return galleryImages.filter((image) => !removed.has(String(image.id)));
  });

  const removedGallery = $derived.by(() => {
    if (!multiple) {
      return [] as Array<{ id: string; name: string }>;
    }

    return removedGalleryIds.map((id) => {
      const image = galleryImages.find((candidate) => String(candidate.id) === id);

      return {
        id,
        name: image ? fileNameFromUrl(image.url) : `Image ${id}`,
      };
    });
  });

  const hasSinglePreview = $derived.by(() =>
    stagedMedia.length > 0 || (!!singleImage && !removedSingle),
  );

  const actionLabel = $derived.by(() => {
    if (multiple) {
      return "Add";
    }

    return hasSinglePreview ? "Replace" : "Upload";
  });

  const singleRemovedName = $derived.by(() =>
    singleImage ? fileNameFromUrl(singleImage.url) : "image",
  );

  const showMediaColumn = $derived.by(() =>
    multiple
      ? visibleGallery.length > 0 || removedGallery.length > 0 || stagedMedia.length > 0
      : hasSinglePreview || removedSingle,
  );

  const openPicker = () => {
    uploadInput?.click();
  };

  const onInputChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    if (multiple) {
      stagedFiles = files;
      return;
    }

    stagedFiles = files.slice(0, 1);

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
    <div class="upload-main">
      <Button type="button" onclick={openPicker}>{actionLabel}</Button>
      <span class="upload-description">{uploadDescription}</span>
    </div>

    {#if showMediaColumn}
      <div class="media-column">
        {#if multiple}
          {#each visibleGallery as image (image.id)}
            <div class="media-card" data-kind="existing">
              <div class="media-thumb-wrap">
                <img class="media-thumb" src={image.url} alt={image.alt} />
                <button
                  type="button"
                  class="remove-chip"
                  aria-label={`Remove ${fileNameFromUrl(image.url)}`}
                  onclick={() => removeGalleryImage(image.id)}
                >
                  ×
                </button>
              </div>
            </div>
          {/each}

          {#each stagedMedia as media (media.url)}
            <div class="media-card" data-kind="staged">
              <div class="media-thumb-wrap">
                <img class="media-thumb" src={media.url} alt={media.alt} />
              </div>
              <div class="status-banner">Staged {media.name}</div>
            </div>
          {/each}

          {#each removedGallery as removed (removed.id)}
            <div class="removed-row">
              <div class="status-banner">Removed {removed.name}</div>
            </div>
          {/each}
        {:else if stagedMedia.length > 0}
          <div class="media-card" data-kind="staged">
            <div class="media-thumb-wrap">
              <img class="media-thumb" src={stagedMedia[0].url} alt={stagedMedia[0].alt} />
            </div>
            <div class="status-banner">Staged {stagedMedia[0].name}</div>
          </div>
        {:else if singleImage && !removedSingle}
          <div class="media-card" data-kind="existing">
            <div class="media-thumb-wrap">
              <img class="media-thumb" src={singleImage.url} alt={singleImage.alt} />
              {#if singleImage.removeFieldName}
                <button
                  type="button"
                  class="remove-chip"
                  aria-label={`Remove ${fileNameFromUrl(singleImage.url)}`}
                  onclick={removeSingleImage}
                >
                  ×
                </button>
              {/if}
            </div>
          </div>
        {:else if removedSingle}
          <div class="removed-row">
            <div class="status-banner">Removed {singleRemovedName}</div>
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    min-height: 8.5rem;
  }

  .upload-main {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
    min-width: 13rem;
  }

  .upload-description {
    color: var(--b-dk);
    font-size: 0.95rem;
    line-height: 1.25rem;
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
    width: min(25rem, 100%);
  }

  .media-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .media-thumb-wrap {
    position: relative;
    width: 100%;
  }

  .media-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    max-height: 14rem;
    object-fit: cover;
    border: 1px solid var(--w-dk);
    background: var(--w-xl);
  }

  .remove-chip {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 1.65rem;
    height: 1.65rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    font-size: 1.35rem;
    line-height: 1;
    color: var(--w);
    background: rgba(27, 55, 80, 0.84);
    cursor: pointer;
  }

  .remove-chip:hover {
    background: rgba(46, 95, 138, 0.92);
  }

  .status-banner {
    padding: 0.35rem 0.65rem;
    color: var(--w);
    font-size: 0.86rem;
    line-height: 1.1rem;
    background: linear-gradient(var(--b-md), var(--p-md));
  }

  .removed-row {
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 860px) {
    .upload-shell {
      flex-direction: column;
    }

    .upload-main,
    .media-column {
      width: 100%;
    }
  }
</style>

<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import ImageUploadSection from "$lib/form/ImageUploadSection.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";
  import type { WebExperienceTarget } from "$lib/editing/web-experience";

  type Props = {
    target: WebExperienceTarget;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    submitFailed?: boolean;
  };

  let {
    target = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    submitFailed = false,
  }: Props = $props();

  const pageTitleError = $derived(
    submitFailed && target.kind === "intro" && !target.pageTitle.trim()
      ? "Page title is required."
      : undefined,
  );
  const introTitleError = $derived(
    submitFailed && !target.title.trim() ? "Title is required." : undefined,
  );
  const bodyError = $derived(
    submitFailed && !target.bodyMarkdown.trim() ? "Body is required." : undefined,
  );
  const primaryLinkError = $derived(
    submitFailed && target.kind === "entry" && !target.primaryLink.trim()
      ? "Primary link is required."
      : undefined,
  );
  const sortOrderError = $derived(
    submitFailed && target.kind === "entry" && Number.isNaN(target.sortOrder)
      ? "Sort order must be a number."
      : undefined,
  );

  const getSecondaryLinkValue = () =>
    target.kind === "entry" ? (target.secondaryLink ?? "") : "";

  const setSecondaryLinkValue = (value: string) => {
    if (target.kind !== "entry") return;

    target = {
      ...target,
      secondaryLink: value.trim() === "" ? null : value,
    };
  };

  const entryLogoUrl = $derived(
    target.kind === "entry" ? (target.logoUrl ?? null) : null,
  );
  const entryImagePreviews = $derived(
    target.kind === "entry" ? (target.imagePreviews ?? []) : [],
  );
</script>

<form
  bind:this={formElement}
  class="editor-form"
  method="POST"
  action="?/save"
  enctype="multipart/form-data"
>
  <input name="kind" type="hidden" value={target.kind} />
  <input name="redirectTo" type="hidden" value="" />

  {#if target.kind === "intro"}
    <TextInput
      id="pageTitle"
      name="pageTitle"
      label="Page Title"
      bind:value={target.pageTitle}
      placeholder="Web Experience"
      required
      error={pageTitleError}
    />

    <TextInput
      id="introTitle"
      name="introTitle"
      label="Intro Title"
      bind:value={target.title}
      placeholder="Intro headline"
      required
      error={introTitleError}
    />

    <MarkdownEditor
      id="introBodyMarkdown"
      name="introBodyMarkdown"
      label="Intro Body"
      bind:value={target.bodyMarkdown}
      description="Intro copy for the page landing pane."
      placeholder="Write the introduction in markdown"
      required
      rows={16}
      error={bodyError}
    />
  {:else}
    <input name="id" type="hidden" value={target.id} />

    <TextInput
      id="title"
      name="title"
      label="Entry Title"
      bind:value={target.title}
      placeholder="Entry title"
      required
      error={introTitleError}
    />

    <TextInput
      id="primaryLink"
      name="primaryLink"
      label="Primary Link"
      bind:value={target.primaryLink}
      placeholder="https://example.com"
      required
      error={primaryLinkError}
    />

    <TextInput
      id="secondaryLink"
      name="secondaryLink"
      label="Secondary Link"
      bind:value={getSecondaryLinkValue, setSecondaryLinkValue}
      placeholder="https://backup-link.com"
    />

    <ImageUploadSection
      sectionTitle="Logo"
      uploadInputId="logoFile"
      uploadInputName="logoFile"
      uploadLabel="Replace Logo"
      uploadDescription="Upload a new logo image to replace the current one."
    >
      {#snippet preview()}
        {#if entryLogoUrl}
          <div class="media-preview-card">
            <img
              class="media-preview-image"
              src={entryLogoUrl}
              alt={`${target.title} logo`}
            />
            <label class="media-toggle">
              <input name="removeLogo" type="checkbox" value="1" />
              Remove current logo
            </label>
          </div>
        {/if}
      {/snippet}
    </ImageUploadSection>

    <ImageUploadSection
      sectionTitle="Screenshots"
      uploadInputId="imageFiles"
      uploadInputName="imageFiles"
      uploadLabel="Add Screenshots"
      uploadDescription="Upload one or more images to append to the screenshot gallery."
      multiple
    >
      {#snippet preview()}
        {#if entryImagePreviews.length}
          <div class="media-grid">
            {#each entryImagePreviews as image}
              <div class="media-preview-card">
                <img
                  class="media-preview-image"
                  src={image.small}
                  alt={`${target.title} screenshot ${image.id}`}
                />
                <label class="media-toggle">
                  <input name="removeImageIds" type="checkbox" value={image.id} />
                  Remove image
                </label>
              </div>
            {/each}
          </div>
        {/if}
      {/snippet}
    </ImageUploadSection>

    <NumberInput
      id="sortOrder"
      name="sortOrder"
      label="Sort Order"
      bind:value={target.sortOrder}
      description="Lower numbers appear earlier in the work list."
      required
      error={sortOrderError}
    />

    <MarkdownEditor
      id="bodyMarkdown"
      name="bodyMarkdown"
      label="Entry Body"
      bind:value={target.bodyMarkdown}
      description="Entry description and markdown content."
      placeholder="Write the entry body in markdown"
      required
      rows={18}
      error={bodyError}
    />
  {/if}

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

  .media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
  }

  .media-preview-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .media-preview-image {
    width: 100%;
    max-height: 220px;
    object-fit: cover;
    border: 1px solid var(--w-dk);
    background: var(--w-xl);
  }

  .media-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>
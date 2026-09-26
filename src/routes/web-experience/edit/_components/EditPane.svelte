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
    deleteSubmitElement?: HTMLButtonElement | null;
    showDeleteButton?: boolean;
    onRequestDelete?: () => void;
    submitFailed?: boolean;
  };

  let {
    target = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    deleteSubmitElement = $bindable(null),
    showDeleteButton = false,
    onRequestDelete,
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
      uploadDescription="Upload a new logo image to replace the current one."
      singleImage={
        entryLogoUrl
          ? {
              url: entryLogoUrl,
              alt: `${target.title} logo`,
              removeFieldName: "removeLogo",
            }
          : null
      }
    />

    <ImageUploadSection
      sectionTitle="Screenshots"
      uploadInputId="imageFiles"
      uploadInputName="imageFiles"
      uploadDescription="Upload one or more images to append to the screenshot gallery."
      multiple
      removeFieldName="removeImageIds"
      galleryImages={entryImagePreviews.map((image) => ({
        id: image.id,
        url: image.small,
        alt: `${target.title} screenshot ${image.id}`,
      }))}
    />

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
      placeholder="Write the entry body in markdown"
      required
      rows={18}
      error={bodyError}
    />
  {/if}

  <div class="actions">
    {#if showDeleteButton}
      <Button type="button" variant="warning" onclick={onRequestDelete}>Delete entry</Button>
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
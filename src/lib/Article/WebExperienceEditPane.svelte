<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";
  import type { WebExperienceTarget } from "$lib/editing/web-experience";

  type Props = {
    target: WebExperienceTarget;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
  };

  let {
    target = $bindable(),
    saveLabel,
    formElement = $bindable(null),
  }: Props = $props();

  const getSecondaryLinkValue = () =>
    target.kind === "entry" ? (target.secondaryLink ?? "") : "";

  const setSecondaryLinkValue = (value: string) => {
    if (target.kind !== "entry") return;

    target = {
      ...target,
      secondaryLink: value.trim() === "" ? null : value,
    };
  };
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
    />

    <TextInput
      id="introTitle"
      name="introTitle"
      label="Intro Title"
      bind:value={target.title}
      placeholder="Intro headline"
      required
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
    />

    <TextInput
      id="primaryLink"
      name="primaryLink"
      label="Primary Link"
      bind:value={target.primaryLink}
      placeholder="https://example.com"
      required
    />

    <TextInput
      id="secondaryLink"
      name="secondaryLink"
      label="Secondary Link"
      bind:value={getSecondaryLinkValue, setSecondaryLinkValue}
      placeholder="https://backup-link.com"
    />

    <div class="media-section">
      <div class="media-section-head">Logo</div>
      {#if target.logoUrl}
        <div class="media-preview-card">
          <img
            class="media-preview-image"
            src={target.logoUrl}
            alt={`${target.title} logo`}
          />
          <label class="media-toggle">
            <input name="removeLogo" type="checkbox" value="1" />
            Remove current logo
          </label>
        </div>
      {/if}

      <label class="upload-field" for="logoFile">
        <span class="upload-label">Replace Logo</span>
        <span class="upload-description"
          >Upload a new logo image to replace the current one.</span
        >
        <input id="logoFile" name="logoFile" type="file" accept="image/*" />
      </label>
    </div>

    <div class="media-section">
      <div class="media-section-head">Screenshots</div>
      {#if (target.imagePreviews ?? []).length}
        <div class="media-grid">
          {#each target.imagePreviews ?? [] as image}
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

      <label class="upload-field" for="imageFiles">
        <span class="upload-label">Add Screenshots</span>
        <span class="upload-description"
          >Upload one or more images to append to the screenshot gallery.</span
        >
        <input
          id="imageFiles"
          name="imageFiles"
          type="file"
          accept="image/*"
          multiple
        />
      </label>
    </div>

    <NumberInput
      id="sortOrder"
      name="sortOrder"
      label="Sort Order"
      bind:value={target.sortOrder}
      description="Lower numbers appear earlier in the work list."
      required
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

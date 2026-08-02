<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";
  import type { WebExperienceTarget } from "$lib/editing/web-experience-editor";

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
</script>

<form bind:this={formElement} class="editor-form" method="POST" action="?/save">
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
      bind:value={
        () => (target.kind === "entry" ? (target.secondaryLink ?? "") : ""),
        (value) => {
          if (target.kind !== "entry") return;
          target = {
            ...target,
            secondaryLink: value.trim() === "" ? null : value,
          };
        }
      }
      placeholder="https://backup-link.com"
    />

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

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>

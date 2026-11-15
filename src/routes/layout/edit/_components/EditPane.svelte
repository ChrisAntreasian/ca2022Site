<script lang="ts">
  import Button from "#lib/form/Button.svelte";
  import TextInput from "#lib/form/TextInput.svelte";

  import type { LayoutEditorValue } from "#lib/editing/resources/layout/layout";

  interface Props {
    layout: LayoutEditorValue;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    submitFailed?: boolean;
  }

  let {
    layout = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    submitFailed = false,
  }: Props = $props();

  const titleError = $derived(
    submitFailed && !layout.title.trim()
      ? "Header title is required."
      : undefined,
  );
</script>

<form bind:this={formElement} class="layout-form" method="POST" action="?/save">
  <TextInput
    id="title"
    name="title"
    label="Header title"
    bind:value={layout.title}
    placeholder="Name shown in the header"
    required
    error={titleError}
  />

  <TextInput
    id="logoUrl"
    name="logoUrl"
    label="Logo image URL"
    bind:value={layout.logoUrl}
    placeholder="https://.../logo.png"
    description="Direct link to the header logo image."
  />

  <div class="actions">
    <Button type="submit">{saveLabel}</Button>
  </div>
</form>

<style>
  .layout-form {
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

  @media (max-width: 767.98px) {
    .actions {
      justify-content: stretch;
    }
  }
</style>

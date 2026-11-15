<script lang="ts">
  import Button from "#lib/form/Button.svelte";
  import TextInput from "#lib/form/TextInput.svelte";

  import type { LandingSection } from "#lib/editing/resources/landing/landing";

  interface Props {
    section: LandingSection;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
    submitFailed?: boolean;
  }

  let {
    section = $bindable(),
    saveLabel,
    formElement = $bindable(null),
    submitFailed = false,
  }: Props = $props();

  const titleError = $derived(
    submitFailed && !section.title.trim()
      ? "Section title is required."
      : undefined,
  );
</script>

<form
  bind:this={formElement}
  class="section-form"
  method="POST"
  action="?/save"
>
  <input name="id" type="hidden" value={section.id} />

  <TextInput
    id="title"
    name="title"
    label="Section title"
    bind:value={section.title}
    placeholder="Home page section title"
    required
    error={titleError}
  />

  <textarea
    id="description"
    name="description"
    class="field-textarea"
    rows={8}
    bind:value={section.description}
    placeholder="Intro text or link caption"></textarea>

  <TextInput
    id="link"
    name="link"
    label="Link"
    bind:value={section.link}
    placeholder="/some-path (optional)"
  />

  <div class="actions">
    <Button type="submit">{saveLabel}</Button>
  </div>
</form>

<style>
  .section-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-textarea {
    width: 100%;
    font-family: inherit;
    padding: 0.5rem;
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

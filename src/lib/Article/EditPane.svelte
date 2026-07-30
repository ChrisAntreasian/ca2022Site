<script lang="ts">
  import Button from "$lib/form/Button.svelte";
  import CheckboxField from "$lib/form/CheckboxField.svelte";
  import MarkdownEditor from "$lib/form/MarkdownEditor.svelte";
  import NumberInput from "$lib/form/NumberInput.svelte";
  import TextInput from "$lib/form/TextInput.svelte";

  import type { PoemEditorValue } from "$lib/editing/poems";

  interface Props {
    poem: PoemEditorValue;
    saveLabel: string;
    formElement?: HTMLFormElement | null;
  }

  let {
    poem = $bindable(),
    saveLabel,
    formElement = $bindable(null),
  }: Props = $props();
</script>

<form bind:this={formElement} class="poem-form" method="POST" action="?/save">
  <input name="id" type="hidden" value={poem.id} />
  <input name="redirectTo" type="hidden" value="" />

  <TextInput
    id="title"
    name="title"
    label="Title"
    bind:value={poem.title}
    placeholder="Poem title"
    required
  />

  <NumberInput
    id="sortOrder"
    name="sortOrder"
    label="Sort Order"
    bind:value={poem.sortOrder}
    description="Lower numbers appear earlier in the poem list."
    required
  />

  <CheckboxField
    id="featured"
    name="featured"
    label="Featured"
    bind:checked={poem.featured}
    description="Reserved for future editorial emphasis and homepage use."
  />

  <MarkdownEditor
    id="bodyMarkdown"
    name="bodyMarkdown"
    label="Body"
    bind:value={poem.bodyMarkdown}
    description="Write in markdown and toggle inline between edit and preview."
    placeholder="Write the poem body in markdown"
    required
    rows={20}
  />

  <div class="actions">
    <Button type="submit">{saveLabel}</Button>
  </div>
</form>

<style>
  .poem-form {
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
<script lang="ts">
  import SvelteMarkdown from "svelte-exmarkdown";
  import Button from "./Button.svelte";

  interface Props {
    id: string;
    name: string;
    label: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    rows?: number;
    description?: string;
    error?: string;
  }

  let {
    id,
    name,
    label,
    value = $bindable(""),
    placeholder,
    required = false,
    rows = 16,
    description,
    error,
  }: Props = $props();

  let mode = $state<"edit" | "preview">("edit");
</script>

<label class="form-field" for={id} style="--form-field-gap: 0.75rem;">
  <div class="head">
    <div>
      <span class="form-field__label">{label}</span>
      {#if description}
        <span class="form-field__description">{description}</span>
      {/if}
    </div>
  </div>
  {#if error}
    <span id="{id}-error" class="form-field__error" role="alert">{error}</span>
  {/if}

  <div class="editor-grid">
    {#if mode === "edit"}
      <textarea
        bind:value
        {id}
        {name}
        {placeholder}
        {required}
        {rows}
        aria-describedby={error ? `${id}-error` : undefined}
        class="form-control form-control--textarea"
        class:form-control--error={!!error}
      ></textarea>
    {:else}
      <textarea
        bind:value
        {id}
        {name}
        {placeholder}
        {required}
        {rows}
        class="sr-only-submit"
        tabindex="-1"
        aria-hidden="true"
      ></textarea>
      <div class="preview">
        <div class="preview-head">Preview</div>
        <div class="preview-body">
          <SvelteMarkdown md={value} />
        </div>
      </div>
    {/if}
  </div>

  <div class="toggle-row">
    <Button
      type="button"
      variant={mode === "edit" ? "submit" : "action"}
      onclick={() => (mode = "edit")}
    >
      Edit
    </Button>
    <Button
      type="button"
      variant={mode === "preview" ? "submit" : "action"}
      onclick={() => (mode = "preview")}
    >
      Preview
    </Button>
  </div>
</label>

<style>
  @import "./field.css";

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .editor-grid {
    display: block;
  }

  .form-control--textarea {
    min-height: 18rem;
    line-height: 1.5rem;
    resize: vertical;
  }

  textarea.sr-only-submit {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    pointer-events: none;
  }

  .preview {
    border: 1px solid var(--w-dk);
    background: var(--w-xl);
    min-height: 18rem;
  }

  .toggle-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .preview-head {
    padding: 0.75rem;
    border-bottom: 1px solid var(--w-dk);
    font-family: var(--font-th);
    letter-spacing: 0.08rem;
    color: var(--b-dk);
  }

  .preview-body {
    padding: 0.75rem;
    overflow: auto;
  }

  @media (max-width: 767.98px) {
    .head {
      flex-direction: column;
    }

    .toggle-row {
      width: 100%;
    }
  }
</style>

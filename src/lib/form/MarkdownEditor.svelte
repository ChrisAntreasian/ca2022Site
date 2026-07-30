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
  }: Props = $props();

  let mode = $state<"edit" | "preview">("edit");
</script>

<label class="field" for={id}>
  <div class="head">
    <div>
      <span class="label">{label}</span>
      {#if description}
        <span class="description">{description}</span>
      {/if}
    </div>
  </div>

  <div class="editor-grid">
    {#if mode === "edit"}
      <textarea bind:value {id} {name} {placeholder} {required} {rows}></textarea>
    {:else}
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
      variant={mode === "edit" ? "primary" : "secondary"}
      onclick={() => (mode = "edit")}
    >
      Edit
    </Button>
    <Button
      type="button"
      variant={mode === "preview" ? "primary" : "secondary"}
      onclick={() => (mode = "preview")}
    >
      Preview
    </Button>
  </div>
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .label {
    display: block;
    font-family: var(--font-th);
    letter-spacing: 0.08rem;
    font-size: 1.25rem;
  }

  .description {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.95rem;
    line-height: 1.25rem;
    color: var(--b-dk);
  }

  .editor-grid {
    display: block;
  }

  textarea {
    width: 100%;
    min-height: 18rem;
    box-sizing: border-box;
    border: 1px solid var(--w-dk);
    padding: 0.75rem;
    font: inherit;
    line-height: 1.5rem;
    color: var(--off-bk);
    background: var(--w-xl);
    resize: vertical;
  }

  textarea:focus {
    outline: 2px solid var(--bg-lt);
    border-color: var(--b-md);
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
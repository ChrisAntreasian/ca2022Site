<script lang="ts">
  interface Props {
    id: string;
    name: string;
    label: string;
    value: number;
    placeholder?: string;
    required?: boolean;
    description?: string;
    error?: string;
  }

  let {
    id,
    name,
    label,
    value = $bindable(),
    placeholder,
    required = false,
    description,
    error,
  }: Props = $props();
</script>

<label class="field" for={id}>
  <span class="label">{label}</span>
  {#if description}
    <span class="description">{description}</span>
  {/if}
  <input
    bind:value
    {id}
    {name}
    type="number"
    {placeholder}
    {required}
    aria-describedby={error ? `${id}-error` : undefined}
    class:input-error={!!error}
  />
  {#if error}
    <span id="{id}-error" class="field-error" role="alert">{error}</span>
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .label {
    font-family: var(--font-th);
    letter-spacing: 0.08rem;
    font-size: 1.25rem;
  }

  .description {
    font-size: 0.95rem;
    line-height: 1.25rem;
    color: var(--b-dk);
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--w-dk);
    padding: 0.75rem;
    font: inherit;
    color: var(--off-bk);
    background: var(--w-xl);
  }

  input:focus {
    outline: 2px solid var(--bg-lt);
    border-color: var(--b-md);
  }

  .input-error {
    border-color: var(--error, #c00);
  }

  .field-error {
    font-size: 0.875rem;
    color: var(--error, #c00);
  }
</style>

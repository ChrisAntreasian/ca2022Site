<script lang="ts">
  interface Props {
    id: string;
    name: string;
    label: string;
    checked?: boolean;
    description?: string;
  }

  let { id, name, label, checked = $bindable(false), description }: Props = $props();
</script>

<label class="field" for={id}>
  <span class="label">{label}</span>
  <span class="row">
    <input bind:checked {id} {name} type="checkbox" />
    <span class="copy">{description ?? "Enable this option"}</span>
  </span>
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

  .row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid var(--w-dk);
    background: var(--w-xl);
  }

  input {
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
  }

  .copy {
    color: var(--b-dk);
    font-size: 1rem;
  }
</style>
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props {
    id: string;
    name: string;
    label: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    type?: "text" | "password";
    autocomplete?: HTMLInputAttributes["autocomplete"];
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
    type = "text",
    autocomplete,
    description,
    error,
  }: Props = $props();
</script>

<label class="form-field" for={id}>
  <span class="form-field__label">{label}</span>
  {#if description}
    <span class="form-field__description">{description}</span>
  {/if}
  <input
    bind:value
    {id}
    {name}
    {type}
    {placeholder}
    {required}
    {autocomplete}
    aria-describedby={error ? `${id}-error` : undefined}
    class="form-control"
    class:form-control--error={!!error}
  />
  {#if error}
      <span id="{id}-error" class="form-field__error" role="alert">{error}</span>
  {/if}
</label>

<style>
    @import "./field.css";
</style>

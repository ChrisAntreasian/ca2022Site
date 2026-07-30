<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";

  interface Props {
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary";
    href?: string;
    fullWidth?: boolean;
    onclick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
    children?: import("svelte").Snippet;
  }

  let {
    type = "button",
    variant = "primary",
    href,
    fullWidth = false,
    onclick,
    children,
  }: Props = $props();
</script>

{#if href}
  <a
    class={`btn ${variant} ${fullWidth ? "full" : ""}`.trim()}
    {href}
    {onclick}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    class={`btn ${variant} ${fullWidth ? "full" : ""}`.trim()}
    {type}
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid transparent;
    font: inherit;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .btn.full {
    width: 100%;
  }

  .btn.primary {
    color: var(--w-xl);
    background: var(--p-md);
  }

  .btn.primary:hover {
    background: var(--p-dk);
  }

  .btn.secondary {
    color: var(--b-dk);
    background: var(--y-lt);
    border-color: var(--y-md);
  }

  .btn.secondary:hover {
    background: var(--w-md);
  }
</style>

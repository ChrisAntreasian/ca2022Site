<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";

  interface Props {
    type?: "button" | "submit" | "reset";
    variant?: "submit" | "warning" | "action";
    href?: string;
    fullWidth?: boolean;
    onclick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
    children?: import("svelte").Snippet;
  }

  let {
    type = "button",
    variant = "submit",
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
    border: 0.2rem solid transparent;
    border-radius: 0.5rem;
    font-family: var(--font-jsf);
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1rem;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .btn.full {
    width: 100%;
  }

  .btn.submit {
    color: var(--w-md);
    background: linear-gradient(var(--b-lt) 75%, var(--b-md));
    border-color: var(--b-dk);
  }

  .btn.submit:hover {
    color: var(--w-lt);
    background: linear-gradient(var(--b-md) 55%, var(--b-lt));
    border-color: var(--b-md);
  }

  .btn.warning {
    color: var(--w);
    background: linear-gradient(var(--o-md) 75%, var(--o-dk));
    border-color: var(--p-dk);
  }

  .btn.warning:hover {
    color: var(--w);
    background: linear-gradient(var(--o-dk) 55%, var(--o-md));
    border-color: var(--p-md);
  }

  .btn.action {
    color: var(--b-dk);
    background: linear-gradient(var(--w-md) 75%, var(--y-lt));
    border-color: var(--y-md);
  }

  .btn.action:hover {
    background: linear-gradient(var(--y-lt) 55%, var(--w-md));
    border-color: var(--y-md);
  }
</style>

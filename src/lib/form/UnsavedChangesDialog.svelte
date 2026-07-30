<script lang="ts">
  import { noScroll } from "$lib/body";
  import Button from "./Button.svelte";

  interface Props {
    open: boolean;
    onStay: () => void;
    onLeave: () => void;
    onSaveAndContinue: () => void;
  }

  let { open = $bindable(false), onStay, onLeave, onSaveAndContinue }: Props = $props();
</script>

<svelte:body use:noScroll={open} />

{#if open}
  <div class="bg-overlay dialog-overlay"></div>
  <div class="dialog-wrap">
    <div class="dialog-card">
      <h2>Unsaved changes</h2>
      <p>
        You have unsaved changes. You can stay on this poem, leave and discard
        them, or save first and continue to the next poem.
      </p>
      <div class="actions">
        <Button type="button" variant="secondary" onclick={onStay}>Stay</Button>
        <Button type="button" variant="secondary" onclick={onLeave}>Leave</Button>
        <Button type="button" onclick={onSaveAndContinue}>Save and continue</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    display: block;
    z-index: 70;
  }

  .dialog-wrap {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    z-index: 71;
    box-sizing: border-box;
  }

  .dialog-card {
    width: min(32rem, 100%);
    background: var(--w-xl);
    border: var(--space-md) solid var(--y-md);
    box-shadow: var(--outershadow);
    padding: 1.25rem;
    box-sizing: border-box;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  @media (max-width: 767.98px) {
    .actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
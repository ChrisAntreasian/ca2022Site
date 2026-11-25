<script lang="ts">
  import { onDestroy } from "svelte";

  import type { Snippet } from "svelte";

  import { noScroll } from "#lib/body";
  import Button from "./Button.svelte";

  interface Props {
    open: boolean;
    title?: string;
    /**
     * The line the dialog shows under its title. `children` replaces it when one is passed, so a dialog that
     * renders its own body (a version list, a picker) does not have to fork this one - and every call site
     * that only passes `message` keeps getting exactly the paragraph it got before.
     */
    message?: string;
    children?: Snippet;
    stayLabel?: string;
    leaveLabel?: string;
    saveAndContinueLabel?: string;
    continueLabel?: string;
    onStay?: () => void;
    onLeave?: () => void;
    onSaveAndContinue?: () => void;
    onContinue?: () => void;
    autoDismissMs?: number;
  }

  let {
    open = $bindable(false),
    title = "Unsaved changes",
    message = "You have unsaved changes. You can stay on this poem, leave and discard them, or save first and continue to the next poem.",
    children,
    stayLabel = "Stay",
    leaveLabel = "Leave",
    saveAndContinueLabel = "Save and continue",
    continueLabel = "Continue",
    onStay,
    onLeave,
    onSaveAndContinue,
    onContinue,
    autoDismissMs,
  }: Props = $props();

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const clearDismissTimer = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };

  $effect(() => {
    clearDismissTimer();

    if (open && autoDismissMs && onContinue) {
      dismissTimer = setTimeout(() => {
        onContinue();
      }, autoDismissMs);
    }

    return () => clearDismissTimer();
  });

  onDestroy(clearDismissTimer);
</script>

<svelte:body use:noScroll={open} />

{#if open}
  <div class="bg-overlay dialog-overlay"></div>
  <div class="dialog-wrap">
    <div class="dialog-card">
      <h2>{title}</h2>
      {#if children}
        {@render children?.()}
      {:else}
        <p>{message}</p>
      {/if}
      <div class="actions">
        {#if onStay}
          <Button type="button" variant="action" onclick={onStay}
            >{stayLabel}</Button
          >
        {/if}
        {#if onLeave}
          <Button type="button" variant="warning" onclick={onLeave}
            >{leaveLabel}</Button
          >
        {/if}
        {#if onSaveAndContinue}
          <Button type="button" variant="submit" onclick={onSaveAndContinue}
            >{saveAndContinueLabel}</Button
          >
        {/if}
        {#if onContinue}
          <Button type="button" variant="submit" onclick={onContinue}
            >{continueLabel}</Button
          >
        {/if}
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

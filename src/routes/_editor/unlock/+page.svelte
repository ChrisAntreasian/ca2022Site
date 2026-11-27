<script lang="ts">
  import Button from "#lib/form/Button.svelte";
  import TextInput from "#lib/form/TextInput.svelte";
  import Shell from "#lib/Article/Shell.svelte";

  import type { ActionData } from "./$types";

  interface Props {
    form?: ActionData;
  }

  let { form }: Props = $props();
</script>

<Shell activeTitle="Unlock editor" defaultHeadline="Unlock editor">
  {#snippet mainContent()}
    <article class="unlock-article">
      <div class="unlock-head">
        <h2>Unlock the content editor</h2>
        <p>Enter the edit key to start a working session.</p>
      </div>

      {#if form?.message}
        <p class="message" role="alert">{form.message}</p>
      {/if}

      <form method="POST" action="?/unlock" class="unlock-form">
        <TextInput
          id="editKey"
          name="editKey"
          label="Edit key"
          type="password"
          autocomplete="current-password"
          error={form?.message}
        />

        <Button type="submit" variant="submit">Unlock edit mode</Button>
      </form>
    </article>
  {/snippet}
</Shell>

<style>
  .unlock-article {
    width: 66.66%;
    min-height: var(--min-height);
    padding: 1.3333rem 2rem 2rem;
    box-sizing: border-box;
  }

  .unlock-head {
    margin-bottom: 1rem;
  }

  .message {
    margin: 0 0 1rem;
    color: var(--o-dk);
  }

  .unlock-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 24rem;
  }

  @media (max-width: 767.98px) {
    .unlock-article {
      width: 100%;
      padding: 1.3333rem 1rem calc(var(--snh) + 2rem);
    }
  }
</style>

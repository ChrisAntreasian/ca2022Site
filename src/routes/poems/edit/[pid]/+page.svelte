<script lang="ts">
  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const currentPoem = $derived(
    form && form.action === "save" && "values" in form && form.values
      ? form.values
      : data.selectedPoem,
  );

  const fieldValue = (name: "title" | "bodyMarkdown") => currentPoem[name];
  const numberValue = (name: "id" | "sortOrder") => currentPoem[name];
  const checkedValue = (name: "featured") => currentPoem[name];
</script>

<svelte:head>
  <title>Poems Editor</title>
</svelte:head>

<section class="editor-shell">
  <article class="editor-panel">
    <header class="editor-header">
      <div>
        <h1>{data.editor.label} Editor</h1>
        <p>
          This editor now lives with the poems route so route composition stays
          local while shared editing and persistence logic remains in lib.
        </p>
      </div>

      {#if data.authorized}
        <form method="POST" action="?/logout">
          <button class="secondary-btn" type="submit">Lock editor</button>
        </form>
      {/if}
    </header>

    {#if form?.message}
      <p class:success={form.action === "authorize" || form.action === "logout"} class="message">
        {form.message}
      </p>
    {/if}

    {#if !data.hasEditKeyConfigured}
      <div class="state-card warning">
        <h2>Missing edit key</h2>
        <p>
          Set CONTENT_EDIT_KEY in your server environment before using the
          editor.
        </p>
      </div>
    {:else if !data.authorized}
      <div class="state-card">
        <h2>Unlock edit mode</h2>
        <form class="auth-form" method="POST" action="?/authorize">
          <label for="editKey">Edit key</label>
          <input id="editKey" name="editKey" type="password" autocomplete="current-password" />
          <button class="primary-btn" type="submit">Unlock</button>
        </form>
      </div>
    {:else}
      <div class="editor-layout">
        <aside class="poem-list">
          <div class="poem-list-head">
            <h2>Poems</h2>
            <a class="secondary-btn link-btn" href={data.editor.newPath}>New poem</a>
          </div>

          <ul>
            {#each data.poems as poem}
              <li class:selected={poem.id === currentPoem.id}>
                <a href={`/poems/edit/${poem.id}`}>
                  <strong>{poem.title}</strong>
                  <span>order {poem.sortOrder}</span>
                </a>
              </li>
            {/each}
          </ul>
        </aside>

        <form class="poem-form" method="POST" action="?/save">
          <input name="id" type="hidden" value={numberValue("id")} />

          {#each data.editor.fields as field}
            <label class="field" for={field.name}>
              <span>{field.label}</span>

              {#if field.kind === "text"}
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  value={fieldValue("title")}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              {:else if field.kind === "markdown"}
                <textarea
                  id={field.name}
                  name={field.name}
                  rows="18"
                  placeholder={field.placeholder}
                  required={field.required}
                >{fieldValue("bodyMarkdown")}</textarea>
              {:else if field.kind === "number"}
                <input
                  id={field.name}
                  name={field.name}
                  type="number"
                  value={numberValue("sortOrder")}
                  required={field.required}
                />
              {:else if field.kind === "checkbox"}
                <input
                  id={field.name}
                  name={field.name}
                  type="checkbox"
                  checked={checkedValue("featured")}
                />
              {/if}
            </label>
          {/each}

          <div class="actions">
            <button class="primary-btn" type="submit">
              {currentPoem.id > 0 ? "Save poem" : "Create poem"}
            </button>
          </div>
        </form>
      </div>
    {/if}
  </article>
</section>

<style>
  .editor-shell {
    width: 100%;
    margin-top: var(--header-height);
    padding: 1rem;
    box-sizing: border-box;
  }

  .editor-panel {
    width: 100%;
    box-sizing: border-box;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .editor-layout {
    display: grid;
    grid-template-columns: 18rem minmax(0, 1fr);
    gap: 1rem;
    margin-top: 1rem;
  }

  .poem-list,
  .poem-form,
  .state-card {
    background: var(--w-lt);
    border: var(--space-md) solid var(--y-md);
    box-shadow: var(--outershadow);
    padding: 1rem;
    box-sizing: border-box;
  }

  .poem-list-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .poem-list ul {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .poem-list li {
    background: var(--w-xl);
    border: 1px solid transparent;
  }

  .poem-list li.selected {
    border-color: var(--o-md);
  }

  .poem-list a {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
  }

  .poem-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field input[type="text"],
  .field input[type="number"],
  .field textarea,
  .auth-form input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--w-dk);
    padding: 0.75rem;
    font: inherit;
    color: var(--off-bk);
    background: var(--w-xl);
  }

  .field input[type="checkbox"] {
    width: 1.25rem;
    height: 1.25rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 24rem;
  }

  .primary-btn,
  .secondary-btn,
  .link-btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    padding: 0.75rem 1rem;
    font: inherit;
    cursor: pointer;
  }

  .primary-btn {
    color: var(--w-xl);
    background: var(--p-md);
  }

  .secondary-btn,
  .link-btn {
    color: var(--b-dk);
    background: var(--y-lt);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .message {
    margin-top: 1rem;
    color: var(--o-dk);
  }

  .message.success {
    color: var(--b-dk);
  }

  .warning {
    border-color: var(--o-md);
  }

  @media (max-width: 767.98px) {
    .editor-shell {
      padding: 0.75rem;
    }

    .editor-header,
    .editor-layout {
      display: flex;
      flex-direction: column;
    }
  }
</style>
<script lang="ts">
  import UnsavedChangesDialog from "#lib/form/UnsavedChangesDialog.svelte";
  import Button from "#lib/form/Button.svelte";

  /**
   * The saved-version picker an editor restores one entry out of.
   *
   * It is two steps in one dialog, and both steps are server data behind server forms and links: step one
   * lists the versions the seam can offer, step two - reached by clicking one version's link - lists that
   * version's entries, each row carrying its own restore form. Nothing here decides what a restore does: the
   * route's `restore` action and the restore seam do, and this component only names them in a form the
   * browser can post.
   *
   * `open` comes from the URL, not from local state. A picker whose open state is a query parameter is a
   * picker the back button leaves working, and one that survives a reload of the page - which is the whole
   * reason every control below is a link or a form rather than a click handler.
   */

  interface RestoreVersionItem {
    timestamp: number;
    scope: string;
    dateLabel: string;
    tierLabel: string;
    href: string;
  }

  interface RestoreEntryItem {
    id: number;
    title: string;
    /** Whether the current draft still holds this entry (`will replace`) or lost it (`will bring back`). */
    willReplace: boolean;
  }

  interface RestoreTargetItem {
    timestamp: number;
    scope: string;
    dateLabel: string;
    tierLabel: string;
    entries: RestoreEntryItem[];
  }

  interface Props {
    open: boolean;
    /** The versions step 1 offers, newest first. */
    versions: RestoreVersionItem[];
    /** The version whose entries step 2 lists, or `null` while the picker is on step 1. */
    target: RestoreTargetItem | null;
    /** Set when a version was named but could not be read, so the picker is back on step 1. */
    note?: string | null;
    /** Where every entry row posts: the route's `restore` action. */
    actionHref: string;
    versionsHref: string;
    closeHref: string;
    /** The draft this restore would replace, carried through untouched: the restore action ignores it. */
    draftVersion: number;
  }

  let {
    open,
    versions,
    target,
    note = null,
    actionHref,
    versionsHref,
    closeHref,
    draftVersion,
  }: Props = $props();
</script>

<UnsavedChangesDialog
  {open}
  title={target
    ? `Restore one poem from the version saved ${target.dateLabel} ${target.tierLabel}`
    : "Restore a saved version"}
>
  {#snippet children()}
    {#if note}
      <p class="restore-note">{note}</p>
    {/if}

    {#if target}
      <p class="restore-lead">
        Pick the poem to put back. Everything else in the current draft stays as
        it is, and the draft this restore replaces is filed in history before it
        is written over.
      </p>

      <ul class="restore-list">
        {#each target.entries as entry (`${entry.id}`)}
          <li class="restore-item">
            <span class="restore-item__id">#{entry.id}</span>
            <span class="restore-item__title">{entry.title}</span>
            <span class="restore-item__mark">
              {entry.willReplace
                ? "will replace"
                : "will bring back (deleted since)"}
            </span>
            {#if entry.id > 0}
              <form class="restore-form" method="POST" action={actionHref}>
                <input type="hidden" name="scope" value={target.scope} />
                <input
                  type="hidden"
                  name="timestamp"
                  value={target.timestamp}
                />
                <input type="hidden" name="entryId" value={entry.id} />
                <input type="hidden" name="draftVersion" value={draftVersion} />
                <Button type="submit" variant="submit">Restore</Button>
              </form>
            {:else}
              <span class="restore-item__unusable">
                this saved copy carries no id a restore can use
              </span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="restore-foot">
        <a class="restore-link" href={versionsHref}
          >Choose a different version</a
        >
        <Button href={closeHref} variant="action">Close</Button>
      </div>
    {:else}
      <p class="restore-lead">
        Pick the version to restore one poem from. Five are listed, newest
        first; each one is labelled with the tier it was found in.
      </p>

      {#if versions.length === 0}
        <p class="restore-empty">
          No saved versions were found for this file yet.
        </p>
      {:else}
        <ul class="restore-list">
          {#each versions as version (`${version.timestamp}:${version.scope}`)}
            <li class="restore-item">
              <a class="restore-version" href={version.href}>
                <span class="restore-item__title">{version.dateLabel}</span>
                <span class="restore-item__mark">{version.tierLabel}</span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="restore-foot">
        <Button href={closeHref} variant="action">Close</Button>
      </div>
    {/if}
  {/snippet}
</UnsavedChangesDialog>

<style>
  .restore-lead,
  .restore-note,
  .restore-empty {
    margin-top: 0.75rem;
  }

  .restore-note {
    /* The same colour the editor uses for a `formMessage`, so a refusal reads like one. */
    color: var(--o-dk);
    font-weight: 700;
  }

  .restore-list {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }

  .restore-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    border-top: 1px solid var(--y-md);
    padding-top: 0.6rem;
  }

  .restore-item__id {
    font-variant-numeric: tabular-nums;
  }

  .restore-item__title {
    flex: 1 1 12rem;
  }

  .restore-version {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
  }

  .restore-item__mark,
  .restore-item__unusable {
    font-size: 0.85rem;
  }

  .restore-item__unusable {
    color: var(--o-dk);
  }

  .restore-form {
    margin: 0;
  }

  .restore-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }
</style>

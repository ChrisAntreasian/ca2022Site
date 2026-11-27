<script lang="ts">
  import UnsavedChangesDialog from "#lib/form/UnsavedChangesDialog.svelte";
  import Button from "#lib/form/Button.svelte";

  /**
   * The saved-version picker an editor restores out of - one entry at a time, or a whole record at a time.
   *
   * It is two steps in one dialog, and both steps are server data behind server forms and links: step one
   * lists the versions the seam can offer, step two - reached by clicking one version's link - lists what that
   * version held. On an entry-list screen that is the version's entries, each row carrying its own restore
   * form. On a whole-record screen it is the version's own record, shown with a plain-language warning of what
   * it replaces and one restore form. Nothing here decides what a restore does: the route's `restore` action
   * and the restore seam do, and this component only names them in a form the browser can post.
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

  /** One row of what a whole-record version holds, named and counted by the resource that owns it. */
  interface RestoreRecordLineItem {
    label: string;
    value: string;
  }

  /**
   * The version a whole-record screen is about to restore.
   *
   * There is no list of entries to pick one out of: a whole-record version is one record, and what the route
   * worked out on the server - this version's own contents, and how they compare with what the editor is
   * holding now - is what the confirm step shows.
   */
  interface RestoreRecordItem {
    timestamp: number;
    scope: string;
    dateLabel: string;
    tierLabel: string;
    /** What this version's record holds, listed in its own order. */
    items: RestoreRecordLineItem[];
    /** Plain-language sentence naming what is about to be replaced, with both counts measured. */
    comparison: string;
  }

  interface Props {
    open: boolean;
    /** The versions step 1 offers, newest first. */
    versions: RestoreVersionItem[];
    /**
     * The version whose entries step 2 lists, or `null` while the picker is on step 1.
     *
     * A whole-record screen passes `null` on every step: it has no entry to single out, and `record` is what
     * its step 2 holds instead.
     */
    target: RestoreTargetItem | null;
    /** The whole record step 2 offers a restore of, on a screen that restores records rather than entries. */
    record?: RestoreRecordItem | null;
    /** What a whole-record screen calls its own record: "home page", "site layout", "terms of service". */
    wholeRecordNoun?: string | null;
    /** Set when a version was named but could not be read, so the picker is back on step 1. */
    note?: string | null;
    /** Where a restore is posted to: the route's `restore` action. */
    actionHref: string;
    versionsHref: string;
    closeHref: string;
    /** The draft this restore would replace, carried through untouched: the restore action ignores it. */
    draftVersion: number;
    /**
     * What the thing being restored is called, so the picker reads in the resource's own words. It is a prop
     * and not a fixed "poem" because this dialog now serves four resources, and a picker that says "poem" on
     * the SoulJuicer screen is a lie about what is inside it. It defaults to the word the poems editor has
     * always used, so that screen reads exactly as it did before.
     */
    entryNoun?: string;
  }

  let {
    open,
    versions,
    target,
    record = null,
    wholeRecordNoun = null,
    note = null,
    actionHref,
    versionsHref,
    closeHref,
    draftVersion,
    entryNoun = "poem",
  }: Props = $props();

  /**
   * Which kind of screen called this dialog: one that restores one entry out of a list, or one that restores a
   * record whole.
   *
   * It is decided by the prop and not by `target == null`, because a whole-record screen leaves `target` empty
   * on purpose - and a component that read the difference from what was left out would have its wording change
   * on a screen it was never meant for.
   */
  const isWholeRecord = $derived(wholeRecordNoun !== null);
</script>

<UnsavedChangesDialog
  {open}
  title={target
    ? `Restore one ${entryNoun} from the version saved ${target.dateLabel} ${target.tierLabel}`
    : record
      ? `Restore the whole ${wholeRecordNoun} saved ${record.dateLabel} ${record.tierLabel}?`
      : "Restore a saved version"}
>
  {#snippet children()}
    {#if note}
      <p class="restore-note">{note}</p>
    {/if}

    {#if target}
      <p class="restore-lead">
        Pick the {entryNoun} to put back. Everything else in the current draft stays
        as it is, and the draft this restore replaces is filed in history before it
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
    {:else if record}
      <p class="restore-lead">{record.comparison}</p>

      {#if record.items.length === 0}
        <p class="restore-empty">
          This version held no part of the {wholeRecordNoun} this editor writes.
        </p>
      {:else}
        <ul class="restore-list">
          {#each record.items as item (item.label)}
            <li class="restore-item">
              <span class="restore-item__id">{item.label}</span>
              <span class="restore-item__title">{item.value}</span>
            </li>
          {/each}
        </ul>
      {/if}

      <p class="restore-lead">
        The whole {wholeRecordNoun} is restored at once: there is no part of it to
        pick out of the version, because a version of a whole record is one record.
      </p>

      <p class="restore-lead">
        A restore writes a new working draft, never a published copy. The {wholeRecordNoun}
        you are editing now is filed in history as it stands before the new draft
        is written, so the copy you are about to replace stays one click away.
      </p>

      <form class="restore-form" method="POST" action={actionHref}>
        <input type="hidden" name="scope" value={record.scope} />
        <input type="hidden" name="timestamp" value={record.timestamp} />
        <input type="hidden" name="draftVersion" value={draftVersion} />
        <Button type="submit" variant="submit"
          >{`Restore the whole ${wholeRecordNoun}`}</Button
        >
      </form>

      <div class="restore-foot">
        <a class="restore-link" href={versionsHref}
          >Choose a different version</a
        >
        <Button href={closeHref} variant="action">Close</Button>
      </div>
    {:else}
      <p class="restore-lead">
        {#if isWholeRecord}
          Pick the version to put the whole {wholeRecordNoun} back into your draft
          from. Five are listed, newest first; each one is labelled with the tier
          it was found in.
        {:else}
          Pick the version to restore one {entryNoun} from. Five are listed, newest
          first; each one is labelled with the tier it was found in.
        {/if}
      </p>

      {#if isWholeRecord}
        <p class="restore-warn">
          Restoring one of these versions replaces the {wholeRecordNoun} you are editing
          now, whole - every section and field it holds - with the version you pick.
          Nothing published is touched, and the copy you are replacing is filed in
          history first.
        </p>
      {/if}

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

  .restore-warn {
    /* A whole-record screen warns about what a restore replaces before the editor clicks anything. */
    margin-top: 0.75rem;
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

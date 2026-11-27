---
description: Card T5 — restore machinery in the editor store seam, plus the poems reference implementation, no UI
argument-hint: "[extra instructions]"
---

Card **T5 of 10** on `feature/s3-json-data-store`. Do only this card. **No UI in this card** — that is
T6. Facts and decisions are in `AGENTS.md` (facts 7 and 10, and the restore decisions block).

${@:-}

## Goal

Give the editor store seam the ability to read a saved version and write part or all of it back as a
new draft, without ever touching `live` and without losing the draft it replaces.

Add to `createJsonEditorStore` (`src/lib/editing/core/store.server.ts`, 62 lines, safe to read whole):

- `listHistoryVersions(limit = 5)` → `store.listHistory(contentKey, { scope: "all", limit })`, newest
  first, each entry carrying its **real scope**. This matters: a `legacy` or `live` entry read with the
  default `draft` scope is a guaranteed miss.
- `readSnapshot(scope, timestamp)` → `store.readHistory(contentKey, timestamp, scope)` → `JSON.parse`
  → `Schema.decodeUnknownResult(schema)` → the decoded snapshot file, or the same `e500` refusal path
  `readFile` uses when the JSON is the wrong shape.
- `restoreWholeRecord(scope, timestamp)` → for the three single-value resources: ensure a baseline
  snapshot of the **current** draft first, then write the snapshot's `data` back as draft with
  `timestamp: Date.now()` and the current `contentKey`. Never `writeLive`.
- `restoreEntry(scope, timestamp, entryId, merge)` → for the four entry-list resources: read the current
  draft, ensure the baseline, then hand the merge helper `{ snapshotFile, currentFile, entryId }` and
  write the result as a new draft stamped `Date.now()`. The seam stays generic; the merge is supplied by
  the resource module so each resource keeps ownership of its own entry rules.

Ordering rule for both: **baseline first, then write.** If that order is wrong the restore destroys the
draft it was meant to protect and the whole feature becomes the bug it was meant to fix. Make it a test,
not a comment.

## Poems reference implementation

- Pure merge helper in `src/lib/editing/resources/poems/poems.ts`, next to `upsertPoemEditorValue`
  (line ~121) and `removePoemEditorValue` (line ~139):
  `restorePoemEntryFromSnapshot({ snapshotFile, currentFile, poemId, now })`.
  Read those two functions first and **reuse** `upsertPoemEditorValue` rather than writing a new insert:
  its id-collision guard already decides "update in place" vs "add", and its ordering rule is the one
  the rest of the app expects. Do not invent a new ordering.
  Semantics to implement and test:
  - the entry exists in the current draft → its content is replaced by the snapshot's copy, id unchanged;
  - the entry was deleted since → it is re-added **with its original id**;
  - every other current entry is left exactly as it is now, byte for byte;
  - the restored entry keeps the snapshot's own `updatedAt` (a restored poem still shows its own date on
    the site) while the file-level `timestamp` is `now`;
  - an `entryId` that is in neither the snapshot nor the current draft is refused loudly.
- Wire it in `src/lib/editing/resources/poems/poems.server.ts` (109 lines) as
  `restorePoemEditorEntryFromSnapshot(params)` calling the seam's `restoreEntry`, plus
  `listPoemEditorHistoryVersions()` and a read of one snapshot's entries that T6's picker will need.

## Tests

New files, not additions to the big ones (`test/lib/editing/resources/*.test.ts` are 797–1170 lines):

- `test/lib/editor-restore.test.ts` — with a fake store of `vi.fn()`s, assert: baseline runs before the
  write; `live` is never written; the written draft carries a fresh timestamp; the restored payload is
  the snapshot's `data`; a `legacy`-scope entry is read with `legacy` passed through; a missing snapshot
  surfaces as an `HttpError` with `status === 500` (AGENTS.md fact 6: assert on `status`/`body.message`,
  never `.message`); a wrong-shape snapshot is refused, not written.
- `test/lib/poems-restore.test.ts` — the pure merge helper, four cases above plus "untouched entries are
  identical" (deep-equal the entries you did not restore against the originals).

## In scope

`src/lib/editing/core/store.server.ts`, `src/lib/editing/resources/poems/poems.ts`,
`src/lib/editing/resources/poems/poems.server.ts`, two new test files.

## Do not

Do not touch any route, `+page.svelte`, `UnsavedChangesDialog.svelte`, `dataStore.server.ts`, or any of
the other six resources. Do not restore `live` snapshots into `live` — a live snapshot may only be read
into the draft.

## Done when

`npx vitest run test/lib/editor-restore.test.ts test/lib/poems-restore.test.ts test/lib/dataStore.test.ts`
green, `svelte-check` clean, prettier/eslint clean, committed, pushed, `docs/handoffs/PROGRESS.md` appended.

## Commit

`feat(editor): restore a saved version into the draft without losing the draft`

## Report back

- Whether `ensureBaselineSnapshot` behaves sanely when there is no draft yet (three keys have no local
  draft file) and what the restore does in that case.
- Anything in `upsertPoemEditorValue` you found that a per-entry restore should not have to know about.
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

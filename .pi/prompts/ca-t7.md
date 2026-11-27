---
description: Card T7 — roll the per-entry restore out to web-experience, the-quintuplapus and the-souljuicer
argument-hint: "[extra instructions]"
---

Card **T7 of 10** on `feature/s3-json-data-store`. T6 landed the poems reference; copy its shape exactly
rather than redesigning it. Do only these three resources.

${@:-}

## Goal

The three other entry-list resources get the same restore: version list → one entry → confirm → status
line. All three already have `upsert*` **and** `remove*` helpers (AGENTS.md fact 10), which is what makes
this card mostly mechanical.

- `src/lib/editing/resources/web-experience/*` — `upsertWebExperienceEditorValue` (line ~139),
  `removeWebExperienceEntry` (line ~235); `src/routes/web-experience/edit/[...wid]/+page.server.ts` (200
  lines) and `+page.svelte` (191 lines).
- `src/lib/editing/resources/quintuplapus/*` — `upsertQuintuplapusEditorValue` (~124),
  `removeQuintuplapusEntry` (~188); `src/routes/the-quintuplapus/edit/[...aid]/+page.server.ts` (141) and
  `+page.svelte` (169).
- `src/lib/editing/resources/souljuicer/*` — `upsertSouljuicerEditorValue` (~133),
  `removeSouljuicerEntry` (~185); `src/routes/the-souljuicer/edit/[...aid]/+page.server.ts` (110) and
  `+page.svelte` (149).

## Steps

1. In each resource's `*.ts`, add `restore<Entry>EntryFromSnapshot({ snapshotFile, currentFile, entryId, now })`
   built on that resource's own `upsert*` (reuse, do not re-implement) and test the four semantics T5
   established for poems: replace in place; re-add with the original id; every other entry untouched;
   the restored entry keeps the snapshot's own `updatedAt` while the file timestamp is fresh.
2. In each `*.server.ts`, add the history-list, snapshot-entries and restore helpers following the poems
   server module (read `src/lib/editing/resources/poems/poems.server.ts`, 109 lines, whole).
3. In each `+page.server.ts` add `historyVersions` + `restoreTarget` + the `restore` action + the
   `?restored=` / `?restore-failed=` messages, following the poems route.
4. In each `+page.svelte` add the nav item and the `HistoryDialog` wiring copied from poems.
5. Where a resource's entry has no `updatedAt` field, say so in the code comment rather than inventing
   one — `web-experience` entries carry a snake_case `updatedAt` that `upsert*` already preserves.
6. `the-souljuicer` has **no bundled live copy** (AGENTS.md fact 8): its draft and live objects exist in
   the bucket but a local-mode read of it fails. Test restore for it in a store that has a draft, and do
   not paper over the bundled gap in this card.
7. Tests: one new file `test/lib/editor-restore-rollout.test.ts` covering all three (one restore case
   each: replace-in-place for one, re-add-for-deleted for another, refusal-on-bad-id for the third) plus
   the route-level `?restored=` message for each. Do not append to `test/lib/typing-*.test.ts` files
   (500–950 lines each).
8. Now that all four entry-list resources can restore, the delete-dialog copy in these three routes that
   still promises restoration is true — leave the wording alone and say so in your report.

## In scope

The three resources' `*.ts` + `*.server.ts`, the three `+page.server.ts` + `+page.svelte`,
`src/lib/editing/HistoryDialog.svelte` (only if it needs a prop for the new resources), new
`test/lib/editor-restore-rollout.test.ts`.

## Do not

Do not touch poems, landing, layout, terms-of-service, the seam, `dataStore.server.ts`, or the
dialog's fallback behaviour. Do not change any `upsert*`/`remove*` semantics to make restore easier —
if a helper cannot express it, restore must build on top of it, not modify it.

## Done when

`npx vitest run test/lib/editor-restore-rollout.test.ts test/lib/poems-restore-ui.test.ts` green,
`svelte-check` clean, prettier/eslint clean, committed, pushed, `docs/handoffs/PROGRESS.md` appended.

## Commit

`feat(editor): restore saved entries in web-experience, the-quintuplapus and the-souljuicer`

## Report back

- Any of the three where reusing `upsert*` was not enough, and why.
- What the history list shows for `the-quintuplapus` and `the-souljuicer` in the **local** store today
  (they each have 1 tiered local snapshot and no legacy history) — that is a UX problem worth reporting.
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

---
description: Card T6 — the poems restore UI: history list, per-entry picker, confirm dialog, status line, route tests
argument-hint: "[extra instructions]"
---

Card **T6 of 10** on `feature/s3-json-data-store`. T5 has landed (the seam can restore). This card is
the **reference UI**, poems only — the other six resources copy it in T7/T8. Do only this card.

Read `AGENTS.md` first. Existing shapes you will build on:
`src/routes/poems/edit/[...pid]/+page.server.ts` (165 lines, read whole),
`src/routes/poems/edit/[...pid]/+page.svelte` (165 lines, read whole),
`src/lib/editing/core/EditorShell.svelte` (306 lines — read only the props block and the
`navigationPane` snippet usage with `rg -n`), `src/lib/form/UnsavedChangesDialog.svelte` (135 lines,
read whole).

${@:-}

## Goal

An editor can see the saved versions of a poem file, pick one, pick **one entry** from it, confirm, and
land on a status line that says what happened — without losing anything they had in the current draft.

## Steps

1. **Dialog gets a slot, not a fork.** `src/lib/form/UnsavedChangesDialog.svelte` currently renders a
   hard-coded `<p>{message}</p>`. Add an optional `children` snippet that renders in place of that
   paragraph when provided, and keep `message` rendering when it is not. Find every call site with
   `rg -n "UnsavedChangesDialog" src` (11 uses across 9 routes) and make sure none of them need
   changing — this is the whole reason the fallback exists.
2. **Load** (`+page.server.ts`): expose
   `historyVersions: { timestamp: number; scope: "draft" | "live" | "legacy"; }[]` — the 5 newest, from
   T5's `listHistoryVersions`. A `live` entry must be labelled "(published version)" in the UI so it is
   obvious it is not a draft.
   When `url.searchParams.get("restore")` holds a timestamp, also expose `restoreTarget`: that snapshot's
   entries (`id` + title) read through the seam with the snapshot's **own scope**, plus the current
   draft's entry ids so the UI can tell an existing entry from a re-add.
3. **Nav entry**: in the `navigationPane(requestNavigation)` snippet add a
   `<li class="nav-action-item">` linking to `?restore=1`, guarded through `requestNavigation` exactly
   like the existing `+ New poem` item, so the dirty-form guard already applies.
4. **New component** `src/lib/editing/HistoryDialog.svelte` built on top of `UnsavedChangesDialog`:
   step 1 lists `historyVersions` newest-first with a formatted date and the tier label; step 2 ( reached
   by choosing a version) lists that snapshot's entries, marking each as "will replace" or "will bring
   back (deleted since)", and each row submits its own restore form. Everything is real server forms —
   hidden `timestamp`, `scope`, `entryId`, and a `draftVersion` hidden field (added in T9, so leave the
   name in place now even if it is unused).
5. **Action** `restore`: validate the three fields, call T5's
   `restorePoemEditorEntryFromSnapshot`, then `redirect(303, poemEditorPath(...) + ?restored=<timestamp>&entry=<id>&scope=<scope>)`.
   On `MissingSnapshotError` or a bad id, do not write: `redirect` back to the editor with
   `?restore-failed=1` and render a refusal line (AGENTS.md fact 6 — assert `status`, not `message`, in
   tests).
6. **Status line**: `?restored=` turns into a load-built message
   (`Restored "Title" from the version saved 22 November 2026 at 14:22.`) reusing the existing
   `savedMessage` / `savedTitle` props in `EditorShell`, and it must say the version it came from, not
   just "saved".
7. **Make the old promise true.** The delete confirm dialog in `+page.svelte` already says "A history
   snapshot is retained so it can be restored later." Once restore works for poems, that sentence is no
   longer fiction; do not weaken it, and do not extend it to resources that cannot restore yet.
8. **Tests**: new `test/lib/poems-restore-ui.test.ts`. Learn the house style first from the most recent
   route test: `git show 32753c5 --stat` then read the test file that commit touched (it is small).
   Assert: at most 5 versions and newest-first; a `live`-tier version carries its scope; `?restore=<ts>`
   exposes that snapshot's entries with correct current-vs-snapshot marking; the restore action redirects
   with `restored`; a bad `entryId` writes nothing and redirects with `restore-failed`; `UnsavedChangesDialog`
   still renders its `message` paragraph when no children are passed (use `renderSnippet` from `svelte`,
   the pattern `test/lib/typing-page.test.ts` already uses — read that pattern with `rg -n renderSnippet`).

## In scope

`src/lib/form/UnsavedChangesDialog.svelte`, new `src/lib/editing/HistoryDialog.svelte`,
`src/routes/poems/edit/[...pid]/+page.server.ts`, `src/routes/poems/edit/[...pid]/+page.svelte`,
`src/lib/editing/resources/poems/poems.server.ts` (only if a helper is still missing),
new `test/lib/poems-restore-ui.test.ts`.

## Do not

Do not touch the other six resources. Do not change `dataStore.server.ts` or the seam (T5 owns those).
Do not prune history, cap stored snapshots, or delete anything. Do not offer "restore the whole file" for
poems — this resource restores entries, by decision.

## Done when

`npx vitest run test/lib/poems-restore-ui.test.ts test/lib/poems-restore.test.ts test/lib/editor-restore.test.ts`
green, `npx svelte-check --tsconfig ./tsconfig.json | tail -5` clean, prettier/eslint clean, all 11
existing `UnsavedChangesDialog` call sites unchanged in behaviour, committed, pushed,
`docs/handoffs/PROGRESS.md` appended.

## Commit

`feat(editor): let a poems editor restore one entry from a saved version`

## Report back

- The exact steps you took in `npm run dev` to click through restore end to end, including which
  version you used and what the status line said.
- Any place where the design forced a decision you think the user should confirm.
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

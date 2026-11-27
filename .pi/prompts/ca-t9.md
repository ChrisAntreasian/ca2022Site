---
description: Card T9 — refuse a restore over unsaved work, and refuse a save that lands on a draft someone else changed
argument-hint: "[extra instructions]"
---

Card **T9 of 10** on `feature/s3-json-data-store`. Both restore cards and the whole-file path are landed.
This card closes the two ways the new feature can lose work. Do only this card.

${@:-}

## Goal

1. An editor must not be able to restore a version while their own unsaved edits are sitting in the form.
2. A save (or a restore) must not silently overwrite a draft that changed since the page was loaded — in
   S3 mode two tabs, or two laptops, or a deploy and a tab can both hold the editor.

## Design (already decided, do not redesign)

- The page's load knows the draft file's `timestamp`. Put it in a hidden field named **`draftVersion`** on
  every **save** form and every **restore** form.
- On submit, compare the submitted `draftVersion` with the draft file's current `timestamp`. Different →
  refuse, do not write, and explain in the message: the draft changed since this page was built, and what
  to do (open the other version, copy your work, reload). Return `fail(...)` with the form's values so the
  editor's text is not lost.
- An explicit "overwrite anyway" opt-in (a checkbox field `overwrite=true`) is allowed, but it must be a
  second, separate action — never the default.
- For restore, the client-side dirty guard is the real protection: the editor's own unsaved edits are not
  in the draft yet, so a restore would drop them. `EditorShell.svelte`'s `isDirty` +
  `requestNavigation` already implement that guard for navigation; verify the restore link goes through it,
  and add a test. Do not build a second dirty-tracking system.

## Steps

1. New `src/lib/editing/core/draftGuard.server.ts` exporting a small pure function
   (`draftChangedSince(submittedVersion, currentVersion)` → boolean) and a helper the actions call
   (`refuseIfDraftChanged({ submitted, current, overwrite, message })`). Keep it out of the seam: the seam
   is 62 lines and stays generic today.
2. Read `src/lib/editing/core/EditorShell.svelte` props block with `rg -n` (306 lines, do not read whole)
   and work out where a hidden field can be carried per form. Then find every form that writes a draft:
   `rg -n "<form|form-action" src/routes src/lib/editing` and list them. Put `draftVersion` in each one,
   from whichever shared component owns it. In your report, list every form you touched and every draft
   write you did **not** cover, if any.
3. Wire the refusal into all seven save actions and all seven restore actions
   (`src/routes/{poems,the-quintuplapus,the-souljuicer,landing,layout,terms-of-service,web-experience}/edit/**/+page.server.ts`).
   Keep each action's existing `fail(...)`/redirect conventions; the refusal must keep the form values.
4. Confirm the restore entry points are all dirty-guarded: for poems/web-experience/quintuplapus/souljuicer
   they are nav links inside the `navigationPane(requestNavigation)` snippet; for the three whole-record
   resources they are too. If any restore button is reachable without the guard, fix it.
5. Tests in new `test/lib/editor-draft-guard.test.ts`: a save whose `draftVersion` does not match refuses
   and leaves the store untouched; the same save with `overwrite=true` writes; a restore with a stale
   `draftVersion` refuses; the refusal message appears in `+page.server.ts` action data; and one test
   proving the refusal does **not** create a baseline snapshot (a refused action must not litter history).

## In scope

New `src/lib/editing/core/draftGuard.server.ts`, the seven `+page.server.ts` files, the shared edit
components that own the forms (poems `EditPane.svelte`, `src/routes/*/_components/PageDetailsEdit.svelte`
421 lines — read with offsets), `EditorShell.svelte` only if a prop is genuinely needed, new
`test/lib/editor-draft-guard.test.ts`.

## Do not

Do not change how `upsert*`/`remove*` work. Do not change the seam's restore ordering (baseline-then-write
is tested in T5). Do not add a new dirty-state tracking system. Do not make overwrite the default
anywhere. Do not touch `dataStore.server.ts` or the bucket.

## Done when

`npx vitest run test/lib/editor-draft-guard.test.ts test/lib/poems-restore-ui.test.ts
test/lib/editor-restore-rollout.test.ts test/lib/editor-restore-wholerecord.test.ts` green,
`svelte-check` clean, prettier/eslint clean, committed, pushed, `docs/handoffs/PROGRESS.md` appended.

## Commit

`fix(editor): refuse saves and restores that would overwrite a draft the editor never saw`

## Report back

- The list of every draft-writing form you found and which ones now carry `draftVersion`.
- Whether two tabs in the **same** browser can currently bypass the guard, and what you saw when you tried.
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

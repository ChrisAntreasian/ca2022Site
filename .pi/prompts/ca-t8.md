---
description: Card T8 — restore for landing, layout and terms-of-service (whole-record unless landing has stable section ids)
argument-hint: "[extra instructions]"
---

Card **T8 of 10** on `feature/s3-json-data-store`. T5 gave the seam `restoreWholeRecord`; T6/T7 proved
the entry path. This card covers the three resources that have no entry list (AGENTS.md fact 10). Do only
this card.

${@:-}

## Goal

`landing`, `layout` and `terms-of-service` get a working restore: version list → confirm what is about to
change → restore the whole record into the draft, with the current draft snapshotted first.

## Steps

1. **Landing first, because it decides itself.** Read `src/lib/editing/resources/landing/landing.ts`
   (~124 lines). Decide which case you are in and say so in your report:
   - its sections have a stable id the editor already uses (the sub-route
     `src/routes/landing/edit/[...sid]` suggests they do) → then landing is a **per-section** restore and
     you should use T5's `restoreEntry` path like the four list resources, reusing
     `upsertLandingEditorValue`;
   - there is no stable id, or the id is derived from position/content → whole-record restore, and you
     must say in the UI that restoring replaces the whole landing page.
     Do not invent an id to make landing match the others. If you find an id, the user must confirm the
     per-section choice before you ship it.
2. `layout` and `terms-of-service` are whole-record by construction (single editor value, no entry id):
   wire T5's `restoreWholeRecord` through their `*.server.ts` modules.
3. Route work in each of the three `+page.server.ts` / `+page.svelte` pairs, following the poems route as
   the reference (read `src/routes/poems/edit/[...pid]/+page.server.ts` whole, then imitate):
   `historyVersions`, the restore picker, a confirm step, `restore` action, `?restored=` / `?restore-failed=`.
   For whole-record the confirm step must state what is about to be replaced in plain language (for
   landing: how many sections exist now versus how many the snapshot held — compute both counts rather
   than describing them).
4. Reuse `src/lib/editing/HistoryDialog.svelte` rather than forking it; if whole-record needs a different
   middle step, add a prop, do not duplicate the component.
5. These three resources each have exactly **one** tiered local history snapshot and no legacy history — so
   in local mode the history list will be nearly empty. Render that honestly ("this content has no older
   saved versions yet") instead of pretending otherwise, and report it as a UX gap.
6. Tests in a new `test/lib/editor-restore-wholerecord.test.ts`: whole-record restore writes draft only,
   snapshots the current draft first, stamps a fresh timestamp, refuses a snapshot whose JSON does not
   decode (assert `status === 500`, AGENTS.md fact 6), and the `?restored=` message lands. If you chose
   the per-section landing path, test that instead for landing and say which you chose.

## In scope

`src/lib/editing/resources/landing/*`, `src/lib/editing/resources/layout/*`,
`src/lib/editing/resources/terms-of-service/*`, their three `+page.server.ts` + `+page.svelte`,
`src/lib/editing/HistoryDialog.svelte` (props only), new `test/lib/editor-restore-wholerecord.test.ts`.

## Do not

Do not touch poems, web-experience, quintuplapus, souljuicer, the seam, or `dataStore.server.ts`. Do not
change the bundled payloads in `src/data/*.json`. Do not offer live-tier restore: a `live` snapshot may be
read into the draft, never written back to live.

## Done when

`npx vitest run test/lib/editor-restore-wholerecord.test.ts test/lib/poems-restore-ui.test.ts` green,
`svelte-check` clean, prettier/eslint clean, committed, pushed, `docs/handoffs/PROGRESS.md` appended.

## Commit

`feat(editor): restore landing, layout and terms of service from a saved version`

## Report back

- Which landing case you landed on, and why.
- The three history lists as an editor would see them today (count of versions per resource).
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

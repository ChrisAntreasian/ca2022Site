---
description: Card T3 — scripts/upload-history.mjs backfills the 61 local legacy history snapshots into the bucket
argument-hint: "[extra instructions]"
---

Card **T3 of 10** on `feature/s3-json-data-store`. Do only this card. It touches **no app code**, so it
cannot break the editor.

${@:-}

## Goal

Local disk holds 72 history snapshots in two layouts; the bucket holds 7 (all
`data/history/draft/...`). The 61 legacy snapshots (`src/data/history/<name>/<ts>.json`) exist only on
this laptop. Copy them into the bucket under the `legacy` tier so the restore UI has something to show
when it runs against S3.

Layouts (AGENTS.md fact 5):

- legacy flat: `src/data/history/<name>/<ts>.json` → bucket `data/history/legacy/<name>/<ts>.json`
- tiered: `src/data/history/<scope>/<name>/<ts>.json` → bucket `data/history/<scope>/<name>/<ts>.json`

The S3 store lists `data/history/` and parses the tier out of the key path, so
`data/history/legacy/poems/3.json` shows up as a `legacy` entry and never as a `draft` entry.

## Steps

1. Read `scripts/seed-s3.mjs` first and copy its shape: `node --env-file=.env.local`, `--apply`
   required to write, otherwise a dry run that prints what it would write.
2. New `scripts/upload-history.mjs` whose logic is a **pure exported plan function** so it is testable
   without AWS:
   `export const historyUploadPlan = (files: {path: string; size: number}[]) => { key, localPath, reason }[]`
   - decide tier vs legacy from the path, not from the directory name being pretty;
   - the first path segment after `history/` is a tier (`draft`, `live`, `legacy`) only when it is one
     of those three words, otherwise the whole thing is legacy;
   - a file whose `<ts>.json` is not an integer, or whose JSON does not parse, is reported as `skipped`
     with a reason — never uploaded;
   - a name segment that is not one of the seven content keys is reported, not silently uploaded.
     The script's `main` walks `src/data/history`, runs the plan, and only with `--apply` performs the
     PUTs. Skip an object that already exists (GET it and treat success as "already there"; do not use
     `HeadObjectCommand`, the current key's permissions are List/Get/Put and GET-then-skip is what the
     rest of this repo does).
3. `package.json`: add a script so the user does not have to remember the flags
   (`"upload:history": "node --env-file=.env.local scripts/upload-history.mjs"`).
4. New `test/lib/upload-history.test.ts` testing only the pure plan function: both layouts, a bad
   timestamp, an unparseable file, an unknown name, and that the tiered copy of `poems` does not shadow
   the legacy copies. Assert the produced keys are exactly what `createS3DataStore` would read back
   (write a test that feeds those keys through the fake client from `test/lib/dataStore.s3.test.ts` —
   read that file's fake client with `rg -n`, do not read the file whole).
5. Run the dry run for real and show the user the plan (`npm run upload:history`). **Do not** pass
   `--apply` in this card; hand the exact command to the user and let them run it, or ask them for
   permission in your report and stop.

## In scope

`scripts/upload-history.mjs`, `package.json` (one added script line), new `test/lib/upload-history.test.ts`.

## Do not

Do not change `src/lib/dataStore.server.ts`, `content.server.ts`, any route, or `scripts/seed-s3.mjs`.
Do not write to the bucket without the user's yes. Do not delete anything from the bucket. Do not prune
history.

## Done when

`npx vitest run test/lib/upload-history.test.ts` green, dry run prints a plan of ~68 uploads (72 local
minus the tiered copies already in the bucket, minus anything skipped) or reports exactly why the count
differs, `svelte-check` untouched so skip it, prettier/eslint clean on the new files, committed, pushed,
`docs/handoffs/PROGRESS.md` appended.

## Commit

`chore(s3): add a dry-run-by-default backfill for the history snapshots that only exist on disk`

## Report back

- The dry-run count, tier by tier, and anything skipped.
- The exact command the user must run to actually upload, and what happens if they run it twice.
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

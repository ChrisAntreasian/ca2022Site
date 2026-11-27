---
description: Card T4 — scripts/pull-content.mjs copies the bucket's draft/live/history back onto disk
argument-hint: "[extra instructions]"
---

Card **T4 of 10** on `feature/s3-json-data-store`. Do only this card. No app code.

${@:-}

## Goal

The mirror card (T2) keeps a local copy of every bucket write, but a dead disk or a new laptop has
nothing to rebuild from. Add the reverse of the seed script: pull the bucket's `draft`, `live` and
`history` objects into `src/data/` so the whole tree can be rebuilt from the bucket alone.

## Steps

1. Read `scripts/seed-s3.mjs` and `scripts/upload-history.mjs` (if T3 has landed) and reuse their style:
   `node --env-file=.env.local`, dry run by default, `--apply` to write, honour `CONTENT_S3_PREFIX`
   (AGENTS.md fact 3 / card T1) so it pulls from whatever prefix the app writes to.
2. New `scripts/pull-content.mjs`:
   - lists `data/draft/`, `data/live/`, `data/history/` under the configured prefix;
   - maps bucket keys to local paths 1:1 (`data/draft/poems.json` → `src/data/draft/poems.json`,
     `data/history/legacy/poems/3.json` → `src/data/history/legacy/poems/3.json`) so the mirrored tree
     looks identical to the bucket tree;
   - **never overwrites an existing local file** unless `--overwrite` is passed, and says so in the dry
     run output;
   - refuses to write anything whose JSON does not parse, and refuses to write a `history` file whose
     path is not one of the two layouts the stores understand;
   - prints a final summary: written, skipped-existing, skipped-bad, and the total bytes.
3. `package.json`: add `"pull:s3": "node --env-file=.env.local scripts/pull-content.mjs"`.
4. New `test/lib/pull-content.test.ts` for the pure parts only (key→path mapping, the refuse-to-clobber
   decision, the reject-bad-layout decision). Use the fake S3 client pattern from
   `test/lib/dataStore.s3.test.ts` (`rg -n "class FakeS3|listPages" test/lib/dataStore.s3.test.ts` and
   read just that block); do not read that file whole.
5. Run the dry run against the real bucket and show the user the output. It must not write anything
   unless they say `--apply`.

## In scope

`scripts/pull-content.mjs`, `package.json`, new `test/lib/pull-content.test.ts`.

## Do not

Do not change `src/lib/**`, any route, `.gitignore`, or the bucket. Do not pull into `src/data/live/`
by hand — that directory is git-tracked after T2 and a silent overwrite there is a content change.
Treat `--overwrite` as something the user must ask for by name.

## Done when

`npx vitest run test/lib/pull-content.test.ts` green, the real dry run prints a complete plan (expect
7 draft + 7 live + however many history objects T1/T3 left in the bucket), prettier/eslint clean on the
new files, committed, pushed, `docs/handoffs/PROGRESS.md` appended.

## Commit

`chore(s3): add a bucket-to-disk pull so the local tree can be rebuilt from the bucket alone`

## Report back

- The dry-run summary numbers.
- Whether pulling a `live` object over a tracked `src/data/live/` file would be a content change the
  user should review, and what the script says about that.
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

---
description: Card T10 — the whole-suite sweep, the runbook, and refreshing AGENTS.md so later sessions are not lied to
argument-hint: "[extra instructions]"
---

Card **T10 of 10** on `feature/s3-json-data-store`. The only card allowed to run the full suite. Read
`AGENTS.md` and `docs/handoffs/PROGRESS.md` first; if the earlier cards did not all land, say so instead of
quietly narrowing the sweep.

${@:-}

## Steps

1. Full unit suite: `npx vitest run 2>&1 | tail -30`. Every failure gets a fix or an explanation in your
   report. Do not skip a test to get green; do not delete a test without saying which and why.
2. `npm run lint` (this runs `prettier --check .` **and** `eslint .` over the whole repo). Fix with
   `npx prettier --write <files>` — never `prettier --write .` across the repo in this card, because the
   mirrored `src/data/**` JSON and the history snapshots are legitimately dirty diffs and a repo-wide
   format would rewrite content files.
3. `npx svelte-check --tsconfig ./tsconfig.json | tail -5` → 0 errors, 0 warnings.
4. `npm run check:encoding` and, because the history snapshots contain non-ASCII names (Māori macrons,
   CJK), `npm run check:encoding:all`. Report anything it flags instead of adding ignore rules.
5. Click through in `npm run dev` and write down what you actually saw, not what the code should do:
   - restore one entry of a poem and see the status line;
   - restore a whole record (terms-of-service is the fastest);
   - save with a stale `draftVersion` and see the refusal, then with `overwrite=true` and see it through;
   - in S3 mode (`CONTENT_LIVE_SOURCE=s3` plus the dev prefix from T1) confirm that a save writes both the
     bucket object and the local file under `src/data/`, and say which files appeared in `git status`.
6. **Refresh `AGENTS.md`** — this is the point of the card. Facts 2, 3, 8 and 9 describe a state that this
   work changes (no local writes; hard-coded prefix; no restore). Update them to what is true now, update
   the date line, and delete decisions that are no longer open. Later sessions read this file instead of
   this chat; a stale fact here is worse than no fact.
7. Runbook into `docs/handoffs/PROGRESS.md`: the exact commands to seed, backfill history, pull the bucket
   back onto a fresh disk, and run a dev-only prefix. Include what the user must **not** run in production.
8. `docs/S3_JSON_DATA_STORE_PLAN.md` (git-ignored, local): add a one-line status to the open-risks sections
   §33.13, §33.15, §33.16, §33.19 and §33.21 — implemented, deferred (with the reason), or still open.
9. Optional, only if the sweep is already clean: move the bucket-inventory probe from
   `C:/Users/chris/Sites/scratch/s3-inventory-2026-11-22.mjs` into `scripts/s3-inventory.mjs` as a tracked,
   read-only probe so the next agent can re-measure instead of trusting this file's numbers. Note the
   scratch directory lives **outside** the repo, so a `--env-file` path there will not find `.env.local`.
10. Commit, push, and re-measure the truth for the report:
    - `npx vitest run` totals;
    - a bucket inventory count (read-only) of `data/**` objects;
    - `git status` after a dev save.

## Do not

Do not implement new features. Do not refactor what T5–T9 already did. Do not prune history, do not delete
bucket objects, do not commit the mirrored `src/data/draft/` or `src/data/history/` files (they stay
ignored by decision; `src/data/live/` is the tracked one).

## Commit

`docs(s3): record what the restore and mirror work actually landed as`
plus any code fixes you needed to make the suite green (say which in the commit body).

## Report back

- The suite totals before and after, and every failure you fixed.
- The click-through results, honestly: what worked, and what you could not make work.
- Exactly which `AGENTS.md` facts you corrected.
- The card order you think should come next, if the user wants more.

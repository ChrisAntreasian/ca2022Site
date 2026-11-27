---
description: Card T1 — CONTENT_S3_PREFIX so a dev write can never reach the prod data/ path
argument-hint: "[extra instructions]"
---

Card **T1 of 10** on `feature/s3-json-data-store`. Facts and decisions are in `AGENTS.md`; the log is
`docs/handoffs/PROGRESS.md`. Do **only this card**, then report and stop.

${@:-}

## Goal

`createS3DataStore` hard-codes `prefix = "data"`, so a dev server with `ENABLE_CONTENT_EDITOR=true`
and `CONTENT_LIVE_SOURCE=s3` edits the same objects production serves. Add a private
`CONTENT_S3_PREFIX` (default `data`) so dev can point at `dev-data/` instead.

## Steps

1. `src/env.ts`: add `CONTENT_S3_PREFIX` with a `description` in the file's existing voice, and a
   `schema` that trims and rejects a value that is not a single safe path segment
   (`^[a-z0-9][a-z0-9-]*$`). Keep `undefined` meaning `data`. Do not add top-level validation that
   throws on import — every other variable here resolves lazily, and `src/lib/content.server.ts` is
   imported by public pages.
2. `src/lib/content.server.ts` (~line 124): pass the prefix into `createS3DataStore({ prefix, fallbacks })`
   read from `$app/env/private`. The bundled fallback map (`fallbacksFor()`) is name-keyed, so it does
   not need to know the prefix — prove that with a test rather than changing it.
3. `scripts/seed-s3.mjs`: make it use the same variable (`CONTENT_S3_PREFIX`, falling back to the
   script's current `S3_DATA_PREFIX`, then `data`) so a seed cannot disagree with the app. Read the
   script first (it is ~100 lines).
4. `.env.example`: document `CONTENT_S3_PREFIX` where the other production variables are documented,
   and state that a dev-only value like `dev-data` needs its own seed run.
5. Tests, in `test/lib/dataStore.s3.test.ts` (read with `rg -n`, do not read the whole file):
   - `new S3DataStore({ prefix: "dev-data", client })` writes draft/live/history keys under
     `dev-data/...` and only under that prefix;
   - a non-default prefix does **not** unlock the bundled live fallback for a key that has no bundled
     copy, and **does** for one that does (a real miss only);
   - two stores with different prefixes do not see each other's keys.
     If `test/lib/editor-dev-prod-split.test.ts` is the natural home for a "dev prefix vs prod prefix"
     assertion, add it there instead (37 lines, safe to read whole).
6. Ask the user before writing anything to the bucket. If they say yes, seed the dev prefix by running
   `npm run seed:s3` with `CONTENT_S3_PREFIX=dev-data` in `.env.local` and report what landed. The
   seed script does not overwrite existing objects, so a re-run is safe.

## In scope

`src/env.ts`, `src/lib/content.server.ts`, `scripts/seed-s3.mjs`, `.env.example`,
`test/lib/dataStore.s3.test.ts`, optionally `test/lib/editor-dev-prod-split.test.ts`.

## Do not

Do not implement mirroring, restore, or any UI. Do not rename `CONTENT_LIVE_SOURCE`. Do not change the
default prefix anywhere: `data` must remain the default so production keeps reading the objects it
already has.

## Done when

Targeted tests green, `npx svelte-check --tsconfig ./tsconfig.json | tail -5` clean, prettier/eslint
clean on the touched files, committed and pushed, `docs/handoffs/PROGRESS.md` appended.

## Commit

`feat(store): name the S3 prefix so a dev write can never land on production data`

## Report back

- The exact dev command to run with a dev prefix.
- Whether the seeded dev prefix now holds draft+live copies of all seven keys (only if the user said yes).
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

---
description: Card T2 — CONTENT_LOCAL_MIRROR: every bucket write also lands on disk, and src/data/live becomes git-tracked
argument-hint: "[extra instructions]"
---

Card **T2 of 10** on `feature/s3-json-data-store`. Read `AGENTS.md` for the facts and the decisions;
do only this card.

${@:-}

## Goal

In S3 mode nothing is written under `src/data/`, so the bucket is the only copy of the editing work.
Add a **write-only local mirror**: a store wrapper that performs every write twice — once against the
primary store (the bucket), once against `fsDataStore` — and reads only from the primary.

Mirror semantics that are already decided:

- Mirror every mutating method **after** the primary succeeds: `writeFile`, `writeLive`,
  `ensureBaselineSnapshot`, `release`. In S3 mode the mirror target is `fsDataStore`.
- Serve every read and query from the primary only: `readFile`, `liveReadFile`, `hasDraftSnapshot`,
  `listHistory`, `readHistory`. A mirror is **never** read. A local draft fallback would let a stale
  copy be saved over newer real data, which is the failure mode this feature exists to prevent.
- A mirror failure must not fail the user's request: log it loudly (`console.error` with the content
  key, the scope and the cause) and let the primary result stand. The primary failing must still fail
  loudly. The very first S3-mode save has no local draft yet, so `ensureBaselineSnapshot` on the mirror
  is expected to fail on some keys — swallow-and-log, do not throw.

## Steps

1. `src/lib/dataStore.server.ts` (722 lines — read the `DataStore` interface near the top and the
   `fsDataStore`/`createS3DataStore` sections with `rg -n`, never the whole file): add
   `createMirroringDataStore({ primary, mirror })` returning a `DataStore`. Put its doc-comment in the
   file's existing voice and say plainly that the mirror is write-only by design.
2. `src/env.ts`: add `CONTENT_LOCAL_MIRROR` (`"false"` disables it; unset or anything else means on),
   described as "in S3 mode, also write a local copy of every draft, live and history object".
3. `src/lib/content.server.ts`: when the store is the S3 store and the mirror is not disabled, wrap it:
   `createMirroringDataStore({ primary: createS3DataStore({ prefix, fallbacks }), mirror: fsDataStore })`.
   Keep the local (non-S3) branch alone — it already writes to `fsDataStore`.
4. `.gitignore`: stop ignoring `src/data/live/` (keep `src/data/draft/` and `src/data/history/` ignored).
   This is the agreed answer to "which local copy is durable enough to commit": published state only.
   Update `.env.example` for `CONTENT_LOCAL_MIRROR` in the same place the other production variables
   are documented.
5. New test file `test/lib/dataStore.mirror.test.ts` (do not append to the 455/446-line existing store
   files). Use a fake primary written with `vi.fn()` spies plus a real `fsDataStore` pointed at a tmp
   directory, and assert:
   - a draft write lands in both, and the local file is the same JSON as the primary's;
   - `ensureBaselineSnapshot` on the primary runs before the mirror's (so the mirror snapshots the
     pre-write draft, not the new one) — this is the assertion most likely to be written wrongly, so
     call it out in a comment;
   - `writeLive` and `release` mirror too, and `release` leaves both stores in the same state;
   - reads come from the primary even when the mirror holds different bytes;
   - a mirror that throws does not reject the caller's write, and the log happens;
   - a primary that throws does reject, and the mirror is not written.
6. `npm run check:encoding`. If it now flags `src/data/live/` because those files hold em-dashes and
   CJK, **stop and report** rather than adding ignore rules.

## In scope

`src/lib/dataStore.server.ts`, `src/env.ts`, `src/lib/content.server.ts`, `.gitignore`, `.env.example`,
new `test/lib/dataStore.mirror.test.ts`.

## Do not

Do not make any read fall back to the mirror. Do not implement restore. Do not seed or write to the
bucket. Do not stage the mirrored JSON files yourself — a later run of the app writes them.

## Done when

Targeted `npx vitest run test/lib/dataStore.mirror.test.ts test/lib/dataStore.test.ts
test/lib/dataStore.s3.test.ts` green, `svelte-check` clean, prettier/eslint clean, committed, pushed,
`docs/handoffs/PROGRESS.md` appended.

## Commit

`feat(store): write a local copy of every bucket write so a lost bucket never means lost work`

## Report back

- Which directories now appear in `git status` after a dev save (run `npm run dev` briefly if you can).
- Whether `src/data/live/` files should be committed by you in this card or left to the app (ask the
  user, then do what they say).
- Commit hash and 3 lines for `docs/handoffs/PROGRESS.md`.

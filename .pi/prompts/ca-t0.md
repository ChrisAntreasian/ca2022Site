---
description: Card T0 — make the tree green again, add the missing S3 history tests, commit the history-read layer
argument-hint: "[extra instructions]"
---

Card **T0 of 10** on branch `feature/s3-json-data-store` in `C:/Users/chris/Sites/ca2022Site`.
`AGENTS.md` is loaded with the verified facts; `docs/handoffs/PROGRESS.md` says where things stand.
Do **only this card**, then report and stop. Do not start T1.

${@:-}

## Goal

The history-reading layer (`listHistory`, `readHistory`, `MissingSnapshotError`, `isMissingSnapshot`)
is written in `src/lib/dataStore.server.ts` but uncommitted, and four tests fail. Land it as one
green commit.

## Steps

1. Read `test/lib/dataStore.test.ts` (455 lines — read the `saved versions` describe block only,
   find it with `rg -n "saved versions"`).
2. Fix the three broken assertions. They are test-authoring bugs, not store bugs:
   - **`lists saved versions without writing anything at all`** — it currently blows up with
     `Error: missing file` from the mocked `fs.readFile`. Decide which side is wrong by reading the
     fs store's `listHistory` (`rg -n "listHistory" src/lib/dataStore.server.ts`, then read that
     range). If `listHistory` only inspects directories, the mock's `readFile` rejection is
     irrelevant to it and the test's fixture is what is broken.
   - **`refuses a missing snapshot instead of answering an empty read`** — the test ends with
     `.catch((cause: unknown) => cause)`, which _resolves_ the promise, so `.rejects` never sees a
     rejection. Replace with `await expect(store.readHistory(...)).rejects.toThrow(MissingSnapshotError)`.
   - **`refuses a version number that is not a real timestamp`** — it asserts
     `rejects.toThrow("valid numeric timestamp")`, but `e500(msg)` throws a Kit `HttpError` with no
     `message` property (see AGENTS.md fact 6). Confirm `isHttpError` is exported by
     `@sveltejs/kit` in this repo (check how `test/lib/content.test.ts` does it), then assert on
     `status === 500` and `body.message` containing the text, or use a bare `.rejects.toThrow()`.
3. Fix the fourth failure `test/lib/editor-dev-prod-split.test.ts` (37 lines, read it whole). It
   expects the committed `.env` to hold `ENABLE_CONTENT_EDITOR=false`; the local `.env` currently has
   `true`. Set `.env` to `false` and leave `.env.local` as the place your own dev override lives
   (`.env.local` already has `ENABLE_CONTENT_EDITOR=true`, so dev keeps working). Tell the user this
   explicitly: it changes what their local dev command does.
4. Add the S3-side history tests to `test/lib/dataStore.s3.test.ts` (446 lines — use `rg -n` and
   read the existing fake-S3-client section once so you reuse its helpers instead of rewriting them).
   Cover, at minimum:
   - `listHistory` returns newest-first across tiers;
   - `limit` is honoured **after** the full paged listing, not during it;
   - pagination: a fake client with several `listPages` pages returns every key exactly once
     (`test/lib/dataStore.s3.test.ts` already has a `test/lib/s3.test.ts` sibling — do not read that
     file whole, just reuse what this file already does);
   - `data/history/legacy/poems/3.json` never parses into a `draft` or `live` entry;
   - `readHistory` with no scope argument reads the draft tier (that is the behaviour the seam will
     rely on) and a `legacy` snapshot must be read with an explicit scope;
   - `NoSuchKey` → `isMissingSnapshot(...) === true`;
   - a network failure surfaces as-is and `isMissingSnapshot(...)` stays false.
5. `npx prettier --write` + `npx eslint` on the three files, then targeted
   `npx vitest run test/lib/dataStore.test.ts test/lib/dataStore.s3.test.ts test/lib/editor-dev-prod-split.test.ts`.
6. `npx svelte-check --tsconfig ./tsconfig.json | tail -5`.
7. Commit all three source/test files in one commit, then push.

## In scope

`src/lib/dataStore.server.ts`, `test/lib/dataStore.test.ts`, `test/lib/dataStore.s3.test.ts`, `.env`.

## Do not

Do not change the store's public interface, do not implement any restore, do not touch
`content.server.ts`, do not run the full 578-test suite, do not put anything in the bucket.

## Commit

`git commit` message: `test(s3): pin the history listing to the shapes the restore work will need`
plus the `.env` change explained in the body. Then `git push origin feature/s3-json-data-store`.

## Report back

- The four failures and what each one really was.
- Whether any failure turned out to be a real store bug.
- Commit hash, and 3 lines for `docs/handoffs/PROGRESS.md`.

# Standing instructions for agents — ca2022Site

Branch `feature/s3-json-data-store`. The durability/restore work is split into cards `T0`–`T10`
(`.pi/prompts/ca-t*.md`, run them as `/ca-t5` etc). **Do one card per session.** Read
`docs/handoffs/PROGRESS.md` before starting and append a short entry when you finish — cards already
listed there as done must not be re-run. Verified 2026-11-22; refresh this file if a fact below stops
being true.

## Verified facts

1. **Store choice is a one-liner and is captured at import time.** Every
   `src/lib/editing/resources/*/*.server.ts` builds
   `createJsonEditorStore({ store: contentDataStore(), … })`. `src/lib/content.server.ts:159`
   returns the S3 store when `CONTENT_LIVE_SOURCE === "s3"`, else `fsDataStore` — and, since `ee06acd`, the
   S3 branch returns it wrapped in `createMirroringDataStore` unless `CONTENT_LOCAL_MIRROR` is `false`.
   Changing the env var on a running server does nothing — a module-level call captured the choice.
2. `CONTENT_LIVE_SOURCE` gates reads **and** writes. The S3 store is wrapped in `createMirroringDataStore`
   (`src/lib/dataStore.server.ts`, since `ee06acd`) unless `CONTENT_LOCAL_MIRROR=false`, so in S3 mode every
   `writeFile`, `ensureBaselineSnapshot` and `release` lands in the bucket **and** under `src/data/draft/`,
   `src/data/live/` or `src/data/history/`. The mirror is write-only by design: every read and query resolves
   to the primary alone, and a mirror failure is logged (`console.error`) without failing a save the primary
   already accepted. `src/data/draft/` and `src/data/history/` stay git-ignored; `src/data/live/` is no
   longer ignored, so a mirrored release shows up in `git status` and a mirrored draft does not.
3. `createS3DataStore` builds every key off one root: `DEFAULT_S3_PREFIX` is `data` (`data/draft/<name>.json`,
   `data/live/<name>.json`, `data/history/<scope>/<name>/<ts>.json`). `CONTENT_S3_PREFIX` (private env var,
   landed in `7698f07`) overrides that root for the app so a dev run can be pointed at `dev-data`; it must be
   one lowercase path segment. `scripts/seed-s3.mjs` reads the same variable, so a seed cannot disagree with
   the app, and `scripts/upload-history.mjs` (T3, `1923d8e`) reads it too - with `--prefix=<root>` as an
   override - so a backfill cannot quietly pick a root the app would not use. The bucket now holds two roots: `data/` (21 objects, production's, and 0 of them touched by the
   dev seed) and `dev-data/` (14 objects: draft + live for all seven keys, seeded 2026-11-22). `.env.local`
   sets `CONTENT_S3_PREFIX=dev-data`, so a dev-server edit lands under `dev-data/`; a deploy that sets nothing
   keeps reading `data/`. Neither root holds any `history/live/` object.
4. Bucket `ca2022s3` inventory (read-only probe, 2026-11-22): 21 objects under `data/` = 7 draft,
   7 live, 7 history (all `data/history/draft/…`), **zero** `data/history/live/…`.
   `GetBucketVersioning` → `AccessDenied` with this key; LIST/GET/PUT work. Prefix listing works
   (`data/history/draft/poems/` returns exactly poems). Measured 2026-11-23 with the backfill script's own
   read-only LIST: `dev-data/history/` holds **0** objects, so nothing in the dev root is restorable yet.
   The pull script's own read-only dry run (2026-11-24) agrees: `dev-data/` = 14 objects, all 14 planned for
   download (467.5 kB, 7 of them live); `data/` = 21 objects, 17 planned + 4 skipped because a byte-identical
   copy is already on disk (550.0 kB).
5. Local disk holds 72 snapshot files in **two layouts**: 61 in the legacy flat layout
   `src/data/history/<name>/<ts>.json` (poems 31, web-experience 24, five singles), 11 in the tiered
   layout `src/data/history/<scope>/<name>/<ts>.json`. The 61 legacy ones exist **only** on this
   laptop; the bucket holds only the 7 tiered draft copies. The backfill's dry run (2026-11-23, no
   `--apply`, `npm run upload:history`) walks all 72 files and plans 71 uploads - 60 legacy, 10 draft,
   1 live - and reports 1 file it refuses: `src/data/history/about/1668876785081.json`, because `about`
   is not one of the seven content keys. Against the production root only 4 of the 71 are already in the
   bucket, so 67 would be new; against `dev-data/` all 71 would be new.
6. `e500(msg)` is `error(500, msg)` from `@sveltejs/kit` 3.1.1. The thrown `HttpError` has keys
   `status` and `body` only — **no `message` property**. The text lives in `body.message`. Assert
   with `isHttpError`/`status`, or a bare `.rejects.toThrow()`; never
   `rejects.toThrow("substring")` for `e500` text (that is what `test/lib/content.test.ts` does).
7. `listHistory` / `readHistory` exist on both stores (committed in `383297c`). The fs store
   also reads the legacy layout; the S3 store has no legacy tier and returns `[]` for
   `scope: "legacy"`. `readHistory(name, ts, scope)` defaults `scope` to `draft`, so a `legacy` or
   `live` entry must be read with its scope passed explicitly. The default limit is 100
   (`DEFAULT_HISTORY_LIMIT`), so a UI that shows 5 asks for `{ limit: 5 }` — it does not get 5 by
   default, and the S3 store pages the whole history before cutting.
   **Consequence recorded in T3:** the card's claim that a `data/history/legacy/...` object "shows up as a
   `legacy` entry" is false today - `createS3DataStore.listHistory` drops every key whose tier is not
   `draft`/`live`, and `readHistory(..., "legacy")` rejects with `MissingSnapshotError`. Uploading the 60
   legacy copies therefore puts objects in the bucket that nothing in the app can list or read, until a
   restore card teaches the store that tier. `test/lib/upload-history.test.ts` pins the gap (its test
   "does NOT list a backfilled legacy snapshot") and is meant to be updated when that card lands.
8. In the S3 store the bundled fallback is `options.fallbacks`, a name-keyed map built by
   `fallbacksFor()` in `src/lib/content.server.ts` from `BUNDLED`. It is consulted **only** on the
   `isNotFound` branch of `liveReadFile` (a real miss), never on a network failure or a wrong-shape
   body (`src/lib/dataStore.server.ts:484`). Because it is keyed by content name it is already
   prefix-agnostic. `src/lib/content.server.ts:214` throws
   `Content key "<name>" has no live copy to release.` when `requireReleasable` is asked about
   bundled content.
9. **Restore does not exist yet.** No `restore*` in `src/lib/editing/core/store.server.ts` (62 lines:
   `readFile`, `liveReadFile`, `ensureBaselineSnapshot`, `writeFile`, `release`), no `restore` action
   in any `+page.server.ts`, no children/slot in `src/lib/form/UnsavedChangesDialog.svelte` (it
   renders `<p>{message}</p>`). Four delete dialogs (poems, quintuplapus, souljuicer,
   web-experience `+page.svelte`) already claim snapshots can be restored — that claim is fiction
   until a card implements it.
10. Resource shapes — per-entry resources have `upsert*` **and** `remove*` helpers you can reuse:
    poems, web-experience, `the-quintuplapus`, `the-souljuicer`. Whole-record resources (one editor
    value, no entry id): landing, layout, terms-of-service.
11. Repo size when you want scale, not reading (`git ls-files`, measured 2026-11-24): 123 source
    TS/Svelte files; 69 test files / 15,580 lines; 256 tracked files / 52,576 lines. Big files you must not
    fully read: `test/lib/dataStore.mirror.test.ts` (1,030), `src/lib/dataStore.server.ts` (821),
    `test/lib/typing-page.test.ts` (934), `scripts/pull-content.mjs` (875),
    `test/lib/upload-history.test.ts` (587), `test/lib/pull-content.test.ts` (571),
    `scripts/upload-history.mjs` (529), `docs/S3_JSON_DATA_STORE_PLAN.md` (~600). Editor
    `+page.svelte` files are 73-191 lines.
12. **Both copy directions exist now, and they do not share one history layout.** `scripts/upload-history.mjs`
    (disk → bucket) and `scripts/pull-content.mjs` (bucket → disk, `42158cf`, npm `pull:s3`) are both
    dry-run-by-default, write only with `--apply`, and take `--prefix=<root>` to override `CONTENT_S3_PREFIX`.
    The pull deliberately does **not** map the legacy tier 1:1: a bucket `history/legacy/<name>/<ts>.json`
    lands in the **flat** `src/data/history/<name>/<ts>.json`, because `fsDataStore` names its own legacy tier
    flat, so a 1:1 copy would park those snapshots behind a local content key called `legacy`. Two tests pin
    both halves (remap readable by `fsDataStore`, 1:1 not). Every `live` row warns that `src/data/live/` is
    git-tracked; `--overwrite` replaces an existing local file only when named, and is refused without
    `--apply`. Neither script has ever been run with `--apply`.

## Decisions already made — do not relitigate

- **`CONTENT_LOCAL_MIRROR` (default on)**: in S3 mode every write also writes the matching local
  file under `src/data/`. A mirror is **written, never read**: draft reads never fall back to it; the
  editor simply fails when S3 reads fail. Local files are read only when the app is configured local
  (`CONTENT_LIVE_SOURCE` unset). The only permitted fallback is the existing bundled-payload live
  fallback, gated on a real miss.
- **Local copies tracked in git: `src/data/live/` only.** Draft and history stay ignored. Landed in **T2**
  (`ee06acd`): `src/data/live/` has come out of `.gitignore`, and `src/data/draft/` and `src/data/history/`
  have not.
- **Restore is per-entry** for the four entry-list resources (restore one entry from a snapshot into
  the current draft, leaving every other current entry alone) and **whole-record** for the three
  single-value resources. Restore writes draft only, never live; it ensures a baseline snapshot of
  the current draft first, and stamps the new file with a fresh timestamp.
- History UI shows the 5 newest versions; nothing is pruned by the app.
- `CONTENT_S3_PREFIX` (default `data`) isolates dev from prod writes.
- Backfill the 61 legacy local snapshots into the bucket as `data/history/legacy/<name>/<ts>.json` —
  **scripted, not run** (T3, `1923d8e`): `npm run upload:history` is the dry run, `--apply` writes, and no
  `--apply` has been executed against either root. Running it before a restore card can read the legacy tier
  puts objects in a bucket that nothing in the app can list (fact 7).
- The pull script maps the bucket's legacy tier onto the flat local legacy dir instead of 1:1, and says so
  (fact 12). Pulling 7 live objects out of `data/` into git-tracked `src/data/live/` is a content change to
  review as a diff, and so is your call to make — not something a script decides for you.
- No new npm dependencies. If forced to install: `npm install --legacy-peer-deps` and add an
  `overrides` entry. Never `npm install` bare (it rewrites `package-lock.json` and dies).

## Discipline (this is what keeps a session under 128k)

- `read` with `offset`/`limit`. Never read a file listed in fact 11 in one go.
- Run **only the test files you touched**: `npx vitest run test/lib/dataStore.test.ts`. The full
  suite belongs to card `T10`.
- Pipe every command through `head`/`tail`. Use `rg`, not `grep -r`. Use `git diff --stat` or a
  pathspec, never bare `git diff`.
- `npx svelte-check --tsconfig ./tsconfig.json | tail -5` once, at the end.
- Never `npm run build` here: `adapter-vercel` uses symlinks and Windows without Developer Mode dies
  with `EPERM`. Run tests with `npx vitest run` only.
- Do not PUT/DELETE in the bucket unless the card authorizes it; read probes are always fine.
- New tests go in a **new file** when the nearest existing test file is over ~450 lines.
- If you sense your context running out: stop, write your state to `docs/handoffs/PROGRESS.md`, say
  which card you are on and what is left, and tell the user to open a new session.

## Finish every card the same way

1. `npx prettier --write <changed files>` → then `npx prettier --check <changed files>`.
2. `npx eslint <changed files>`.
3. Targeted `npx vitest run <test files you touched>` — 0 failed.
4. `npx svelte-check --tsconfig ./tsconfig.json | tail -5` → 0 errors, 0 warnings.
5. `npm run check:encoding` when you touched anything with prose or em-dashes.
6. Commit with the message the card gives you, then `git push origin feature/s3-json-data-store`.
7. Append ≤5 lines to `docs/handoffs/PROGRESS.md`, then **stop**. Do not start the next card.

# SvelteKit 2 -> 3 migration checklist

Branch: `sveltekit-migration-3x` · BASELINE = the newest `KIT3(...)` commit reported by
`git --no-pager log --oneline -8` (protocol step 1). Verified green points so far: `410fcb8` (env +
adapters + scripts), `69c6ad3` (docs), `5dcb9a3` (facts), `fc50b42` (item 4), `6baa13c` (item 6 + item 8
part 1), `509a8d1` (item 8 parts 2a + 2b), `4b973ce` (item 5 - the whole test suite is now type-checked:
`tsc` 83 -> 0 and `svelte-check` 94 -> 0, 409/409 tests green) and the newest `KIT3(item-9)` commit (lint
toolchain repaired - `git --no-pager log --oneline -1` names it). Items 0-9 are CLOSED; item 10 is the
defined next step.
Installed: `@sveltejs/kit@3.1.x`, `vite@8.3.5` (beta/rolldown), `svelte@5.57`, `vitest@5`,
`@sveltejs/adapter-vercel@7.0.2`, `@sveltejs/adapter-auto@8.0.0` (devDependencies),
`@sveltejs/vite-plugin-svelte@7.3.1`, `typescript@5.9.2` (kit's `typescript ^6` peer is OPTIONAL - do not
bump TS as a side effect; it is its own gated step)

## Protocol (read this first on every new session)

1. Read this file + `git --no-pager log --oneline -8` + `git --no-pager diff HEAD@{1} --stat`.
   Do NOT re-read `vite.config.js` / `tsconfig.json` / Kit source unless the diff says they changed.
2. Work ONE checklist item at a time. Do not start the next item before its gate passes.
3. Verification gates (these exact commands are already validated - do not rediscover them):
   - `npx svelte-kit sync` -> Kit writes generated config; watch for warnings
   - `npx svelte-check --tsconfig ./tsconfig.json --output human` -> error count + buckets
   - `npm run build` -> exit 0 + `.vercel/output/**` produced (adapter-vercel NEVER writes `build/`).
     On THIS box it currently dies at `EPERM: symlink ... '.vercel\output\functions\index.func'` AFTER
     `.vercel/output/static` + `functions/![-]/catchall.func/**` exist - see item 2 (Windows privileges).
   - `npx vite preview --port 4173` over `.svelte-kit/output` -> the runtime gate that DOES work here
     (GET `/` and `/poems` must be 200 with SSR'd markup, bogus route 404). Probe `localhost`, not 127.0.0.1.
   - `npm run test:unit` -> vitest suite
4. After each item: commit with prefix `KIT3(item-n):`. One item = one commit = revertible.
5. Update this file (Status table / checkboxes) as the LAST action of the item, before committing.

## Current measurements (2026-10-31, re-measured after item 9)

| Measurement                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx svelte-kit sync`                               | **ZERO warnings** - `config_option_deprecated_alias` AND `tsconfig_invalid` are both gone now that `alias` no longer exists in `sveltekit()`                                                                                                                                                                                                                                                                                                                                                               |
| `npx tsc --noEmit -p tsconfig.json`                 | **0** errors (was **83**; closed by item 5); `TS2307` / `Cannot find module` = **0**                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run check` (`svelte-kit sync` + svelte-check)  | **0 errors, 0 warnings** (svelte-check was **94 errors / 15 files** until item 5; CFM stayed **0** throughout. It briefly spiked to **243 total / 149 CFM** the instant the aliases were removed without tsconfig `paths` - see item 8). Plain `tsc` cannot see `.svelte` prop errors, so `npm run check` is the only gate that measures the truth                                                                                                                                                         |
| `vite dev`                                          | ✅ `ready in 1806 ms`; `/` 200 (71 KB), `/poems` 200 (90 KB), bogus route 404                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `vite preview` on `.svelte-kit/output`              | ✅ `/` 200 (24.7 KB, `<h1>` SSR'd), `/poems` 200 (37.4 KB), bogus 404                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Editor env gate (`$app/env/private`)                | 403 when `ENABLE_CONTENT_EDITOR=false` → 404 when `=true`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run build`                                     | Vite compiles BOTH bundles cleanly (`349` server + `897` client modules, `built in ~650-870 ms`); adapter-vercel then hits **Windows symlink EPERM** (item 2) -> exit 1. Needs Developer Mode/admin                                                                                                                                                                                                                                                                                                        |
| `npm run test:unit` (vitest)                        | ✅ **42 test files / 409 tests passed**, 12.87 s (was 9.37 s, then 11.7 s). One run failed 5 route tests with `Test timed out in 5000ms` under load; the same 5 files then passed in isolation (11/11) and the full suite re-ran green - re-run before believing a failure                                                                                                                                                                                                                                 |
| `npm run lint` (= `prettier --check . && eslint .`) | **GREEN end to end since item 9.** Before it: `eslint .` = **154 problem files / 5627 problems (5626 errors)**, `prettier --check .` = 7 red files, and both lint scripts passed a Prettier-3 option (`--plugin-search-dir`) that Prettier 3 deleted. Now `eslint .` = **0 problems**, `prettier --check .` = **0 files**, `npx eslint test` + `npx prettier --check test/**/*.ts` still clean. STILL NOT COVERED: `.svelte` files - prettier parses none of them here, 43 of 48 are unformatted (item 10) |
| Working tree                                        | clean after each item commit (protocol 4); no scratch files left                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Historical baseline (measured at a6fe9a9 - superseded by the table above)

| Measurement                | Result                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`            | **EXIT 0**, "built in 825ms" - Kit 3 + Vite 8 + Svelte 5 compile fine                                                                                   |
| `build/` output dir        | **ABSENT** (only `.svelte-kit/output/{client,server}`) -> `npm start` + Vercel broken                                                                   |
| `adapter_missing` warning  | **PRESENT** - the adapter is never applied                                                                                                              |
| `svelte-check` diagnostics | **98** (was 302 before Kit options moved into `sveltekit()`)                                                                                            |
| `Cannot find module` count | **2** (was ~250) - both are `$env/dynamic/private`                                                                                                      |
| Kit warnings seen          | `config_option_deprecated_alias`, `tsconfig_invalid` ("paths" overwritten), and 3x `tsconfig_extends_missing` during build (names root `tsconfig.json`) |

## Decisions already made (do not re-litigate)

- `svelte.config.js` stays DELETED: Kit 3 throws `config_file_unsupported` if it exists
  (`node_modules/@sveltejs/kit/src/exports/vite/index.js:278`). All Kit options belong inside
  `sveltekit({ ... })` in `vite.config.js`; Vite's own `resolve.alias` is NOT used by Kit for
  bundling or for generating tsconfig `paths`.
- **esbuild/keepNames is SETTLED (probe-verified 2026-10-31, experiment reverted, tree clean)**. This
  repo's `vite.config.js` NEVER contained an `esbuild`, `keepNames` or `build.rollupOptions` key -
  `git log --all -S keepNames`, `-S esbuild -- vite.config.js` and `-S build.rollupOptions` each return
  ZERO commits across every branch/stash. Facts (all measured, do not re-derive):
  - `esbuild?: ESBuildOptions | false` is still valid in Vite 8 (`node_modules/vite/dist/node/index.d.ts:3544`),
    and Vite forwards it for you: `if (merged.esbuildOptions.keepNames !== void 0 &&
rolldownOptions.output.keepNames === void 0) rolldownOptions.output.keepNames = merged.esbuildOptions.keepNames`
    (`node_modules/vite/dist/node/chunks/node.js:37610`). No manual rewiring is needed.
  - Rolldown's `keepNames` lives under **`output`**, NOT `transform`: `RolldownOptions` has no `transform`
    key, so `rolldownOptions.transform.keepNames` was invalid nesting (this is what misfired). Also
    `build.rollupOptions` is a _deprecated alias_ of `build.rolldownOptions` (index.d.ts:3626-3633).
  - Rolldown VALIDATES output keys. A bogus key emits `Warning: Invalid output options (1 issue found) -
For the "zzzNotARealRolldownOption". Invalid key: Expected never but received "zzzNotARealRolldownOption"`
    and the build still completes. `keepNames` triggers NO such warning, and the string exists in the native
    binding (`rolldown-binding.win32-x64-msvc.node`, 2 matches) -> `output.keepNames` IS recognized.
  - Measured effect on THIS app: `keepNames: false`, `keepNames: true` and no option at all produce
    BYTE-IDENTICAL bundles (every client chunk hash+size unchanged, e.g. `DCC4OjZ_.js 424820`,
    `BJPyF4Sh.js 119811`, `D9xoH6gv.js 54856`), and no `__name(` / `__keepNames` helper is emitted.
    Nothing in `src` reads `fn.name` (only `File.name` in `media.server.ts`). -> the knob is a NO-OP here,
    so DO NOT add it; keep `vite.config.js` exactly as committed.
  - `@dcma77/logger` and `wrapLoggerName` DO NOT EXIST in this repo: absent from `package.json`, absent from
    `src` imports, and zero matches across `node_modules`. The "logger breaks when fn.name is stripped"
    symptom belongs to a different project/tree - it cannot occur here.
- `npm run check` / `svelte-check` do not type-check `vite.config.js` (root `tsconfig.json` sets
  `allowJs: false`, `checkJs: false`), so an untyped rolldown option in it produces no diagnostic.

## Checklist (one item per session, gate before starting the next)

- [x] 0. Kit options moved into `sveltekit()` (adapter + preprocess + alias) in `vite.config.js`.
- [x] 1. Root `tsconfig.json` now `extends: "$app/tsconfig"` + `include: ["src","test","*"]` +
      `exclude: ["src/service-worker"]` (it used to extend the empty `.svelte-kit/tsconfig.json` stub).
      Post-0+1 gate: `tsc` = 85 errors (2 CFM), `svelte-check` = 98 (2 CFM).
- [x] 2. **Adapters + plugin peers (DONE - Windows caveat left)**: upgraded to adapter-vercel 7.0.2,
      adapter-auto 8.0.0 (moved from `dependencies` -> `devDependencies`, where adapters belong) and
      vite-plugin-svelte 7.3.1 (kit 3's REQUIRED peer). A plain `npm install` is impossible here without
      `--legacy-peer-deps`: npm reports `Conflicting peer dependency: typescript@6.0.3` for kit's
      `typescript ^6.0.0` peer while `@typescript-eslint/*` pins `>=4.8.4 <6.1.0` (found 5.9.2). Kit marks
      that peer `optional: true`, so 5.9.2 is legitimate; typescript@6.0.3 WOULD satisfy every chain but a
      TS major bump must be its own gated step, not a side effect of an adapter upgrade.
      Kit 2 adapter error (`adapter_generate_manifest_removed`) is GONE - adapter 7 runs to the end.
      Windows blocker: adapter-vercel 7 symlinks every route to the main function
      (`node_modules/@sveltejs/adapter-vercel/index.js:254,256,315-316`; `Config` has NO toggle for it),
      and this account lacks `SeCreateSymbolicLinkPrivilege` (`whoami /priv`) with Developer Mode off ->
      `npm run build` dies with `EPERM: symlink ... '.vercel\output\functions\index.func'` AFTER
      `.vercel/output/static` + a complete `.vercel/output/functions/![-]/catchall.func/**` are produced.
      User-side fixes (all need admin): enable Windows Developer Mode, run the shell elevated, or grant the
      privilege via secpol.msc. Vercel CI builds on Linux, so real deploys are unaffected.
      GATE SEMANTICS: adapter-vercel never writes a root `build/` dir - the gate is `.vercel/output/**`.
      So `package.json`'s `start: node build/index.js` is Kit 2 leftover cruft, and since Kit 3's CLI
      exposes ONLY `sync` (`npx svelte-kit --help`), the `package: svelte-kit package` script is dead too.
      DONE: `package: svelte-kit package` deleted (Kit 3 CLI has no `package` command) and `start`
      re-pointed to `vite preview`, because Kit 3 + adapter-vercel never emit a root `build/` dir.
- [x] 3. **Env imports (DONE)**: `$env/dynamic/private` -> `$app/env/private`. Kit 3 gives NO `env`
      object: every var declared in `src/env.ts` becomes its OWN named export, so `s3.ts` now imports
      `{ AWS_ACCESS_KEY_ID, AWS_ACCESS_SECRET, AWS_BUCKET, AWS_REGION, VITE_* }` and `auth.server.ts`
      imports `{ ENABLE_CONTENT_EDITOR }`. The legacy `X ?? VITE_X` fallbacks were preserved by
      re-declaring the 4 `VITE_AWS_*` names in `src/env.ts` (`.env`/`.env.local` only contain `AWS_*` +
      `ENABLE_CONTENT_EDITOR`, so these are pure insurance and can be dropped later).
      Gate result: `tsc` 85 -> 83, TS2307 = 0, svelte-check 98 -> 94, CFM = 0.
      PITFALL: after ANY edit to `src/env.ts` you must run `npx svelte-kit sync`, otherwise
      `node_modules/$app/types/env.d.ts` is stale and you get `TS2724 has no exported member ...`.
- [x] 4. **Delete the fake page store (DONE)**: deleted `src/app/server/entry.ts` (the whole now-empty
      `src/app/` dir) and rewrote `src/app.d.ts` to `/// <reference types="@sveltejs/kit" />` + `export {}`.
      VERIFIED FACTS found while doing it: entry.ts exported ONLY a `readable()` const - it never exported a
      `Page` type, so `app.d.ts:3` (`import type { Page } from './app/server/entry.js'`) and `app.d.ts:8`
      (`export declare const page: Readable<Page | null>`) were both invalid constructs; nothing outside
      `app.d.ts` ever imported them (verified with `git grep`), and the four components that need page state
      already use `import { page } from "$app/state"` (`Header.svelte`, `Footer.svelte`, `+error.svelte`,
      `EditorShell.svelte`). `test/setup.ts` now mocks `$app/state` with the getter shapes from
      `@sveltejs/kit/src/runtime/app/state/client.svelte.js:65-150` (no `subscribe` fields - Kit 3 state is
      not a store). GATE: `svelte-check` 94 errors/0 warnings (UNCHANGED, and zero diagnostics mention
      `app.d.ts` or `entry.ts`), `tsc --noEmit` 83 (UNCHANGED, 0 in the two files), `npm run test:unit` =
      **42 files / 409 tests passed in 9.37s**, dev-server smoke still 200/200/404.
- [x] 5. **Type-check the whole test suite (DONE)**: `tsc` 83 -> **0** and `svelte-check` 94 -> **0**
      (0 warnings in both). ALL 94 were in `test/**` - `src/**` never produced a single one of them - so this
      item is test-only and no app behaviour changed. Eight buckets, counted by the codemods' own tallies
      (20 + 12 + 6 + 35 + 11 + 3 + 2 + 5 = 94, and `tsc`'s 83 = 94 minus the 11 component-prop diagnostics it
      cannot see), each closed over the exact match set - never a blind global replace (a naive `as never);`
      swap would also have rewritten the `actions.save(... as never)` calls and broken their parens):
  - **20**: `toBeInTheDocument` "does not exist". `test/setup.ts` imported the plain
    `@testing-library/jest-dom` entry, which carries no Vitest matcher augmentation at all;
    `@testing-library/jest-dom/vitest` is the subpath that extends Vitest's own `Assertion`.
  - **12**: `unknown` -> `Schema<unknown, unknown, never>` in `test/lib/api.test.ts` - raw literals handed
    straight into effect codecs, fixed with `Schema.decodeUnknownSync` + `as unknown as`.
  - **6**: `Error & { status, body }` rejection mocks. Kit 3 rejects with a real `HttpError` carrying
    `status` + `message` + `body`, so the `error()` / `fail()` mocks had to conform (4 "not assignable",
    1 `Effect<never, Error & {...}>`, 1 `Either<never, Error & {...}>`).
  - **35**: Kit 3's `void | PageData` load returns across 7 route tests. The new `test/routes/loadResult.ts`
    helper wraps the 11 `await load(... as never)` calls so the result narrows once instead of casting at
    35 separate property accesses.
  - **11**: drifted component-test fixtures + the removed `slots` render option (10 in `Gallery.test.ts`,
    1 in `Article.test.ts`, both invisible to plain `tsc`). `Gallery.test.ts` had a hand-written
    `ArtWithId` mirror that had drifted (no `publishedAt`, wrong `image` arm) - now typed with the
    production export. `Article.test.ts` used RTL-Svelte's `slots` render option that Svelte 5 deleted -
    now a `createRawSnippet` `children` prop.
  - **3**: `provider` / `formats` read off the `imageC` union in `test/lib/editing-web-experience.test.ts`
    (1 `provider`, 2 `formats`) - narrowed with `Extract` aliases instead of casting per access.
  - **2**: the souljuicer-edit save mock had a zero-arg signature, so `mock.calls[0][0]` was a `[]` tuple
    (TS2493) and `calls[0]` was possibly undefined (TS2532). Fixed with a
    `Mock<(value: SavedSouljuicerValue) => Promise<...>>` annotation - annotating the parameter types
    instead of declaring them also keeps `no-unused-vars` quiet on a mock that ignores its argument.
  - **5**: S3 / build / media mock odds and ends - `getObject` and `upload` "does not exist on type
    'unknown'", an "{} is not callable" in `build.test.ts`, and the `initS3` tests that CONSTRUCT the
    mock, which exposed the arrow-implementation bug written up in the pitfalls below.
    GATE: `npx svelte-kit sync` silent, `npm run check` = **0 errors / 0 warnings**, `npx tsc --noEmit` =
    **0 diagnostics**, `npm run test:unit` = **42 files / 409 tests in 11.7 s**, `npx eslint test` +
    `npx prettier --check test/**/*.ts` clean, and the counted-codemod scratch (`.cache/*.cjs`) was deleted
    before committing (protocol: no scratch files left).
- [x] 6. **vitest config (DONE)**: removed the dead `$app` -> `.svelte-kit/runtime/app` alias. Proof it
      was dead: Kit 3 never emits that path, `node_modules/$app` contains ONLY `tsconfig/`, `types/` and
      `tsconfig.json` (types, not runtime), and Kit declares `$app/*` as ambient modules itself
      (`@sveltejs/kit/src/exports/vite/write_app_types.js:281` writes `declare module "$app/types" { ... }`);
      Kit's vite plugin injects no literal `"$app..."` aliases either (grep found none). `$lib`/`$data` stay in
      `resolve.alias` because vitest still needs them at runtime. GATE: `svelte-check` 94 errors / 0 warnings
      (unchanged) and `npm run test:unit` = 42 files / 409 tests passed in 9.22 s, zero `Failed to resolve` /
      `Cannot find module`. Remaining note: `vitest.config.ts` calls `sveltekit()` with NO Kit options
      (no adapter/preprocess/alias) which is harmless for tests - tests never produce a deployment.
- [x] 7. **Runtime smoke test (DONE)**: `vite dev` -> `VITE v8.3.5 ready in 1806 ms`, `/` 200 (71 KB),
      `/poems` 200 (90 KB), bogus route 404 ✓. Production `vite preview` over `.svelte-kit/output` ->
      `/` 200 (24.7 KB, `<h1>` SSR'd), `/poems` 200 (37.4 KB), bogus 404 ✓ - preview does NOT need the
      adapter to finish. Editor gate proven end-to-end through `$app/env/private`:
      `/poems/edit/nonexistent-zzz` returns **403** with `ENABLE_CONTENT_EDITOR=false` and **404** with
      `=true` (guard passes, fake pid 404s) ✓. Only warnings in either mode are
      `config_option_deprecated_alias` + `tsconfig_invalid` (Windows false positive).
      GOTCHAS: Vite binds `::1`, so probe `http://localhost:PORT` - `127.0.0.1` is refused. Use
      `--strictPort`; `Start-Process -RedirectStandardOutput` only flushes when the process exits, so read
      the port from `--port` instead of parsing the log. Process env beats `.env`, so shell
      `ENABLE_CONTENT_EDITOR` is authoritative for these tests.
- [x] 8. **Cleanup leftovers (part 1 + parts 2a + 2b DONE - ITEM CLOSED)**: root junk `index.ts` (0 bytes, zero references) and
      `test-mkkey.js` (an ad-hoc `mkKeyWDefault` demo importing `../src/lib/file.js`, zero references) are
      now DELETED (verified with `git grep`: nothing referenced either). Earlier in this item: the dead
      `svelte-kit package` script was deleted, `start` -> `vite preview`, adapter-auto moved to
      devDependencies, and every scratch capture file was deleted.
      DONE (part 2a - the `#lib`/`#data` subpath-import codemod): package.json now declares Node subpath
      imports `"imports": { "#lib/*": "./src/lib/*", "#data/*": "./src/data/*" }`; every `$lib/...` and
      `$data/...` import in `src/**` and `test/**` was rewritten to `#lib/...` / `#data/...` (92 files,
      **291 insertions / 291 deletions** - pure 1:1 import swaps, zero other content change); the deprecated
      `alias` option was DELETED from `sveltekit()` in `vite.config.js` and from `resolve.alias` in
      `vitest.config.ts`; and `tsconfig.json` gained
      `"paths": { "#lib/*": ["./src/lib/*"], "#data/*": ["./src/data/*"] }`.
      THE FACT THAT MATTERS: Vite, Vitest and Node read package.json `imports` natively - TypeScript 5.9.2 in
      this repo does NOT, because it inherits `paths: {}` from `node_modules/$app/tsconfig.json`. Removing the
      aliases without adding `paths` made `tsc` and `svelte-check` report **149 `TS2307 Cannot find module
'#lib/...'`** (svelte-check total 243 errors / 86 files) - i.e. the aliases had been propping up
      TypeScript the entire migration. `npx tsc --showConfig` proves the extends chain was intact
      (`moduleResolution: bundler`, `resolvePackageJsonImports: true`, `paths: {}`) yet `#lib/*` was still
      unresolvable, so the `paths` entries are MANDATORY, and they work WITHOUT `baseUrl` (adding `baseUrl`
      would break the inherited Kit config).
      GATE (all measured after the codemod): `npx svelte-kit sync` -> **zero warnings** (`config_option_deprecated_alias`
      and `tsconfig_invalid` - the two warnings framing this whole migration - are GONE); `svelte-check` 94 errors /
      0 warnings / 15 files and `tsc` 83 errors = both EXACTLY the pre-codemod baseline, CFM = 0;
      `npm run test:unit` = **42 files / 409 tests passed** in 10.3 s, zero `Failed to resolve`; `npm run build`
      compiles both bundles (`✓ built in 699 ms`) then dies only at the Windows adapter symlink EPERM (item 2);
      `git grep` finds no `$lib` / `$data` import left anywhere in `src` or `test`.
      DONE (part 2b - vitest peer unpin): `@vitest/ui` and `@vitest/coverage-v8` moved from `3.2.4` to
      `^5.0.5`, aligned with vitest 5.0.5. `npm ls vitest @vitest/ui @vitest/coverage-v8` ->
      `vitest@5.0.5`, `@vitest/coverage-v8@5.0.5`, `@vitest/ui@5.0.5` (all deduped, no peer errors), with
      `package-lock.json` rewritten by the install (740 line churn, 642 deletions of stale 3.x-era entries).
      GATE: `npm run test:unit:coverage` now runs the full 42-file suite and prints the per-file table +
      summary: **Statements 75.63% (596/788), Branches 49.03% (255/520), Functions 74.87% (155/207),
      Lines 75.46% (569/754)**. Item 8 is therefore COMPLETE - nothing left open in it.
- [x] 9. **Lint toolchain repaired (DONE - `.svelte` formatting carved out as item 10)**. Before the fix
      (all measured, all reproducible at `4b973ce`): `eslint .` produced **154 problem files / 5627 problems
      (5626 errors, 1 warning)** and almost none of it was the app - ESLint 9 flat config does NOT read
      `.eslintignore` (it prints `ESLintIgnoreWarning` and proceeds), so `.svelte-kit/generated/**`,
      `.svelte-kit/output/**`, `.vercel/output/static/**` and `coverage/**` were being linted as if they were
      source; `npm run lint` and `npm run format` both passed `--plugin-search-dir=.`, a flag Prettier 3 deleted;
      and `prettier --check .` reported 7 red files.
      DONE: (a) `eslint.config.js` gained a standalone global `{ ignores: [...] }` entry (the deleted
      `.eslintignore` contents plus `.vercel/`, `.output/`, `test-results/`), `globals` became
      `{ ...globals.browser, ...globals.node }` (the browser-only block was why `docs/_audit.cjs` failed with
      `'require' is not defined` / `'__dirname' is not defined`), and a `**/*.cjs` override
      (`sourceType: "commonjs"` + `@typescript-eslint/no-require-imports` off) was added for real CommonJS
      tooling; (b) `.eslintignore` and `.eslintrc.cjs` DELETED - the eslintrc was already inert under flat config,
      named plugins that are not installed (`svelte5`, `svelte3/svelte3`), contained a typo
      (`"plugn:@typescript-eslint/recommended"`) and nothing ever read it (`git grep`), yet ESLint was linting it
      as source (`'module' is not defined`); (c) `lint` / `format` lost the dead flag; (d) `.prettierrc` is now
      `{ "endOfLine": "auto" }` and `.prettierignore` was rewritten to the Kit-template artifact list.
      TWO PRE-EXISTING BUGS THIS ITEM EXPOSED (they were broken at `4b973ce`, not caused by it):
      (1) the old `.prettierignore` entry was the bare word `build`, and prettierignore patterns are
      gitignore-style, so it ignored EVERY directory named `build` at any depth - which had silently kept
      `src/routes/{,poems/,the-quintuplapus/,the-souljuicer/,web-experience/}build/[bid]/+page.server.ts`
      (5 real route files) out of prettier's view forever. Reopening them with `/build` reflowed them
      style-only: `'#lib/build'` -> `"#lib/build"`, tab-indented `populate` arrays -> 2-space, arrow parens,
      trailing commas, missing final newlines, and the duplicated `"image.media"` populate entries survive
      verbatim (prettier does not "fix" them). Zero semantic change.
      (2) 4 of the 7 "red" files (`README.md`, `CONTENT_EDITING_PLAN.md`, `scripts/check-mojibake.mjs`,
      `src/env.ts`) were red for NO content reason - `core.autocrlf = true` with no `.gitattributes`, every
      indexed blob is LF (`git ls-files --eol` -> `i/lf w/crlf attr/`), and prettier's default
      `endOfLine: "lf"` fought the CRLF-smudled checkout. `endOfLine: "auto"` ends the fight, and those 4 files
      were recorded byte-identical by git. Only `ENV_EDITOR_FINDINGS.md` (11 lines) and `MIGRATION_SUMMARY.md`
      (20 lines) got genuine markdown reflow (blank line before every list, list-continuation alignment,
      code-fence comment spacing).
      GATE (re-measured): `npx eslint .` = **0 problems** (was 5627), `npx prettier --check .` = **0 files**
      (after this entry is formatted, `npm run lint` green end to end), `npm run check` = **0 errors /
      0 warnings**, `npx tsc --noEmit` = **0 diagnostics**, `npm run test:unit` = **42 files / 409 tests**
      (12.87 s), `npm run check:encoding` green, `npx svelte-kit sync` still silent. This item's commit is 14
      files (`git show --stat` names them; its exact line totals keep drifting as this file keeps editing
      itself, so do not quote them): 2 deleted configs (37 lines), 4 config
      files, 2 reflowed docs and 5 build-route
      files (156 formatting-only lines) and this checklist itself. `src/**` content is otherwise untouched -
      `src/env.ts` and `scripts/check-mojibake.mjs` were prettier-written but git recorded them
      byte-identical (eol churn only). `src` holds 48 `.svelte` files and `test` holds none, so the
      43-unformatted figure above is the whole component surface.
- [ ] 10. **Prettier-format the `.svelte` components (NOT STARTED - needs a user decision)**. Prettier 3 no
      longer auto-loads plugins and this repo never declares any, so prettier parses ZERO `.svelte` files
      (forcing one prints `[error] No parser could be inferred for file ...`). Declaring the plugin that is
      already installed (`prettier-plugin-svelte@3.5.2`) via `.prettierrc { "plugins": [...] }` immediately
      makes **43 of the 48 `src/**/*.svelte` files** red (`npx prettier --plugin prettier-plugin-svelte --check
"src/**/*.svelte"` -> "Code style issues found in 43 files"). A 43-component whitespace reformat on a
      site whose poem/art markup is whitespace-sensitive must be its own gated item with a real markup review.
      Its gate when taken on: `npm run test:unit` (real components are rendered by `test/lib/Gallary/Gallery.test.ts`
      and `test/lib/Article/Article.test.ts`), `npm run check`, `npx tsc --noEmit`, and item 7's
      dev + preview 200/200/404 smoke.

## Hard-won facts (do not re-derive these)

- Kit 3 writes the generated tsconfig + `paths` to `node_modules/$app/tsconfig.json`.
  `.svelte-kit/tsconfig.json` is an EMPTY stub (`{"compilerOptions":{},"include":[],"exclude":[]}`) -
  never extend it, that was the whole `$lib` breakage.
- Kit's `tsconfig_invalid` / `"paths" was overwritten` warning WAS a **Windows false positive** in the
  `alias` era: `write_tsconfig/validate.js` + `get_paths` compared backslash-absolute expected paths
  against forward-slash TS-resolved paths (proof then: `npx tsc --traceResolution` said
  `Module name '$lib/date' was successfully resolved to .../src/lib/date.ts`). Since item 8 part 2a
  deleted `alias` outright, the warning now has nothing to complain about and `sync` is silent.
  STILL-TRUE PROBE FACTS: `node_modules/$app/tsconfig.json` ships `paths: {}`; `{"$lib/*": ["./src/lib/*"]}`
  without `baseUrl` resolves to NONE; adding `baseUrl: "."` breaks the inherited Kit config. Therefore the
  ONLY working alias replacement is package.json `imports` PLUS root-`tsconfig.json`
  `paths: {"#lib/*": ["./src/lib/*"], "#data/*": ["./src/data/*"]}` (no `baseUrl`) - which item 8 part 2a
  now has. Do not conclude "TypeScript reads `#imports` for free" without checking `paths`.
- `read_files` served **stale content** in this repo (`vite.config.js`, `tsconfig.json`, a Kit source
  file showed content that did not match disk). Cross-check important files with `Get-Content` before
  editing, and trust `git show HEAD:<file>`.
- Kit 3 `$app` submodules that exist: `env, environment, forms, internal, manifest, navigation,
paths, server, service-worker, state`. `$app/stores` is GONE - use `$app/state`, which the app
  already uses (`Header.svelte`, `Footer.svelte`, `+error.svelte`, `EditorShell.svelte`).
  `MIGRATION_SUMMARY.md` ("BLOCKED - layout refactor required") is outdated and should be distrusted.
- Build gate semantics: adapter-vercel emits `.vercel/output/**`, never `build/`; `start` is now
  `vite preview` and the dead `package: svelte-kit package` script is deleted (item 2). Preview works on
  `.svelte-kit/output` even when the adapter cannot finish on Windows.
- Doc provenance: `CONTENT_EDITING_PLAN.md` added at `923df83`, `MIGRATION_SUMMARY.md` at `1d7faf3`,
  `ENV_EDITOR_FINDINGS.md` at `a6fe9a9`, `MIGRATION_KIT3_CHECKLIST.md` at `410fcb8`.
- No scratch files remain (every `.out`/`.err`, `c5.txt`, `c6.txt`, `build.out`, `sync.out` and
  `scripts/_tsprobe.cjs` are deleted). This bullet used to cite "real tooling like `.eslintrc.cjs`" as proof
  that `scripts/` was clean - that sentence was wrong twice over: `.eslintrc.cjs` sat at the ROOT (never in
  `scripts/`), and item 9 deleted it together with `.eslintignore`. `scripts/` now holds exactly one file,
  `check-mojibake.mjs`. If a session recreates scratch files, delete them before committing.
- Kit 3.1.0 peers: `typescript ^6.0.0` and `@opentelemetry/api` are `optional: true` in
  peerDependenciesMeta, so remaining on typescript 5.9.2 is fine (svelte-check 4.3.1 peer `>=5.0.0`).
  Required peers: `vite ^8.0.12` (8.3.5 ✓), `svelte ^5.57.1` (5.57.2 ✓),
  `@sveltejs/vite-plugin-svelte ^7.0.0` (7.3.1 ✓ installed at `410fcb8`). vitest 5.0.5 peer
  `vite ^6.4.0 || ^7.0.0 || ^8.0.0` ✓. Kit also depends on `@rolldown/pluginutils ^1.0.1`
  (vite 8.3.5 is rolldown-based; vite-plugin-svelte prints an "experimental vite 8" warning).
- `src/env.ts` validators MAY be plain functions - `EnvVarConfig.schema` is
  `StandardSchemaV1<string|undefined,T> | ((value: string|undefined) => T|undefined)` and Kit wraps
  plain functions via `normalize_env_schema` (`src/exports/env/index.js`). No zod needed.

- ~~`$lib` strategy = HYBRID: keep `alias: { $lib: './src/lib', $data: './src/data' }` in `sveltekit()`~~
  (Kit's own sanctioned escape hatch) to reach green, then do the `#lib` codemod as item 8. `alias` is
  deprecated in Kit 3.1 (`src/core/config/options.js:56`), so it is temporary.~~ SUPERSEDED by item 8
  part 2a: `alias` is now DELETED from both `sveltekit()` in `vite.config.js` and `resolve.alias` in
  `vitest.config.ts`. The Kit 3 replacement that actually works is package.json `imports` + tsconfig
  `paths` (see item 8 and the `tsconfig_invalid` fact above).
- `tsconfig_invalid` is no longer even a warning to reason about - it is GONE, because the `alias` it was
  complaining about no longer exists. The probe script it referred to (`scripts/_tsprobe.cjs`) is deleted.
- Plain `tsc` is NOT a substitute for `npm run check` on component tests. `.svelte` imports resolve through
  Kit's ambient module declaration, so prop mismatches in `test/lib/Gallary/Gallery.test.ts` and
  `test/lib/Article/Article.test.ts` were invisible to `tsc` (0 errors there) while `svelte-check` reported
  11 of them. Item 5 only closed once BOTH were run.
- Constructable mocks need a FUNCTION implementation: `initS3` builds the client with `new AWS.S3(...)`,
  and vitest builds a mock by constructing whatever implementation `vi.fn` was handed, so an arrow impl
  dies with `TypeError: () => mockS3Instance is not a constructor`. The old test hid this behind a double
  cast that called the mock as a plain function; retyping it as `new AWS.S3({...})` made 4 tests red until
  the spy was `vi.fn(function () { ... })`.
- `vi.mock` factories run at hoisted-import time, so a factory must not reference a top-level `const`
  directly: `S3: mockS3Constructor` threw `Cannot access 'mockS3Constructor' before initialization`. It has
  to be created INSIDE the factory, or deferred behind a closure that only reads it when called.
- `imageC = Union(imageBaseC, imageAttrsC)` in `src/lib/typing/art.ts` means `provider` / `formats` exist on
  only one arm, and the record arm's own `formats` may be `null` or `{}` as well. Narrow test assertions
  with `Extract` aliases (`Extract<ImageAttributes, { formats: unknown }>`) rather than reaching through the
  union or casting per access.
- `svelte-check --output machine` capture: pipe with `| Out-File -Encoding utf8` (a `>` redirect writes a
  2-line stub here). `--no-pager` is NOT a svelte-check option - it aborts the run with "Unknown option"
  and silently produces an empty capture, which reads as "0 diagnostics".
- ESLint 9 flat config reads NEITHER `.eslintignore` NOR `.eslintrc.cjs`. It prints
  `ESLintIgnoreWarning: The ".eslintignore" file is no longer supported` and carries on regardless, so every
  generated artifact on disk gets linted - on this repo that was 154 problem files / 5627 problems, mostly
  `.svelte-kit/**` (manifest modules full of "undefined" `__SVELTEKIT_MANIFEST_*` globals),
  `.vercel/output/static/**` chunks and `coverage/**`. The fix is a STANDALONE `{ ignores: [...] }` entry in
  `eslint.config.js` - a global `ignores` only applies to the config object that is nothing but `ignores`.
- An inert legacy config file gets linted AS SOURCE, and that is how you can tell it is dead:
  `.eslintrc.cjs` produced `'module' is not defined`, `'require' is not defined` and
  `A require() style import is forbidden` precisely because no tool was reading it - only
  `git grep -n eslintrc` proving no reference existed made deletion safe.
- `languageOptions.globals` must actually cover the code: a browser-only `globals.browser` block made real
  CommonJS tooling (`docs/_audit.cjs`) fail on `require`/`__dirname`. Kit's own template config spreads
  `...globals.browser, ...globals.node` for exactly this reason. Pair it with a `**/*.cjs` override
  (`sourceType: "commonjs"` and `@typescript-eslint/no-require-imports` off), because `tseslint`
  `configs.recommended` applies TS-flavoured rules to `.cjs` too.
- A bare `.prettierignore` token is gitignore-style and matches at ANY depth: the old `build` line hid
  `src/routes/<5 routes>/build/[bid]/**` from prettier permanently. Anchor artifact patterns with a leading
  `/` (`/build`, `/.svelte-kit`, `/coverage`). Symmetrically, ESLint needs `.vercel/`/`.svelte-kit/` listed
  explicitly - it does not honor `.gitignore`.
- `core.autocrlf = true` with no `.gitattributes` + prettier's default `endOfLine: "lf"` = every
  CRLF-smudled working file is prettier-red with nothing wrong in its content. Fix it in `.prettierrc`
  (`{ "endOfLine": "auto" }`), do not fight the checkout. Proof tool: `git ls-files --eol` (here: `i/lf
w/crlf attr/` for dozens of files, zero `i/crlf`). Caveat: `git diff --stat` swallows pure-eol churn, so
  judge the real commit contents with `git status --short` and `git diff --cached --stat` after staging.
- Prettier 3 deleted `--plugin-search-dir` AND stopped auto-loading plugins. `.svelte` files therefore get no
  parser at all (`[error] No parser could be inferred for file ...` when forced, and they are skipped
  silently when globbing) unless `plugins` is declared in config. `prettier-plugin-svelte@3.5.2` has been in
  `devDependencies` the whole time and has never done anything.
- Paths containing `[param]` brackets cannot be passed to prettier as CLI patterns (micromatch reads `[bid]`
  as a character class -> "No files matching the pattern"). Work around it with a bracket-free glob
  (`"src/routes/**/*page.server.ts"`) and, for git diffs, with the pathspec magic
  `git diff --cached -- ":(literal)src/routes/build/[bid]/+page.server.ts"`.
- Vitest 5's default 5 s test timeout is reachable under parallel load: one full `npm run test:unit` run
  failed 5 route tests (`web-experience`, `terms-of-service`, `terms-of-service-edit`, `the-souljuicer`,
  `poems-edit` page.server tests) with `Test timed out in 5000ms`, while the same 5 files ran green alone
  (11/11) and the full suite re-ran 42/409 green. Re-run before investigating.
- ESLint 9 dropped the `compact` formatter from core ("The compact formatter is no longer part of core
  ESLint"), and `git diff HEAD@{1}` must be single-quoted in PowerShell because `@{...}` is splat syntax -
  unquoted it becomes the revision `HEAD@`.

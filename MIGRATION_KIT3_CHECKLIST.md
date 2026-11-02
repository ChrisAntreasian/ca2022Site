# SvelteKit 2 -> 3 migration checklist

Branch: `kit3-effect4` (the live branch; it continues `sveltekit-migration-3x` at `6145476`) · BASELINE = the newest `KIT3(...)` commit reported by
`git --no-pager log --oneline -8` (protocol step 1). Verified green points so far: `410fcb8` (env +
adapters + scripts), `69c6ad3` (docs), `5dcb9a3` (facts), `fc50b42` (item 4), `6baa13c` (item 6 + item 8
part 1), `509a8d1` (item 8 parts 2a + 2b), `4b973ce` (item 5 - the whole test suite is now type-checked:
`tsc` 83 -> 0 and `svelte-check` 94 -> 0, 409/409 tests green), the `KIT3(item-9)` commit (lint toolchain
repaired), then `50581c5` (item 11 - hygiene), `b6fcbaa` (item 12 - kit core chain), `7fa13c6` (item 13 -
ESLint 10), `b7a6131` (item 14 - prettier-plugin-svelte 4), `b4cba38` (item 15 - test/DOM/runtime chain),
`610d5ec` (item 16 - the `effect` v3 -> v4 source migration, `effect 4.1.1`), `0a3fba1` (item 16's docs
close-out) and the `KIT3(item-17)` commit that closes the TypeScript major (`typescript 6.0.3`, pinned
`~6.0.3`, with the literal line `"strict": false` now written in root `tsconfig.json`).
**Items 0-9 and 11-17 are CLOSED; item 10 is CLOSED as a phantom** (its "43 of 48 `.svelte` files must be
reformatted" premise does not reproduce - see item 14). Remaining open work on this branch: item 18 (the
Playwright `testMatch`/`webServer` config), item 19 (TypeScript **strict adoption** - the debt item 17 pins
rather than pays: 37 measured diagnostics), and item 2's Windows symlink EPERM on `npm run build` (which also
blocks Playwright's `webServer`, so no local e2e gate can be validated end to end).
Installed (re-measured in the item-17 working tree): `@sveltejs/kit@3.1.1`, `vite@8.3.5` (beta/rolldown),
`svelte@5.57.3`, `vitest@5.0.5`, `@sveltejs/adapter-vercel@7.0.2` + `@sveltejs/adapter-auto@8.0.0`
(devDependencies), `@sveltejs/vite-plugin-svelte@7.3.1`, `eslint@10.14.0` + `@eslint/js@10.0.1` +
`typescript-eslint@8.72.1` + `globals@17.14.0`, `prettier@3.9.10` + `prettier-plugin-svelte@4.1.1`,
`@playwright/test@1.64.1`, `@testing-library/jest-dom@7.0.1` (next to the exact-pinned `svelte@5.4.2` and
`user-event@14.6.8`), `effect@4.1.1` and **`typescript@6.0.3`** - kit's `typescript ^6.0.0` peer is now
SATISFIED (the old "deduped invalid" noise label is closed - its fact bullet was rewritten), and the pin is
`~6.0.3` because the only legal band is `>=6.0.0 <6.1.0`. The swap landed as its own item, never as a side
effect of another install.

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

## Measurements after item 9 (2026-10-31 - superseded by the 2026-11-01 table at the foot of this file)

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
- [x] 10. **Prettier-format the `.svelte` components (CLOSED WITHOUT A REFORMAT - superseded; see item 14)**. Prettier 3 no
      longer auto-loads plugins and this repo never declares any, so prettier parses ZERO `.svelte` files
      (forcing one prints `[error] No parser could be inferred for file ...`). Declaring the plugin that is
      already installed (`prettier-plugin-svelte@3.5.2`) via `.prettierrc { "plugins": [...] }` immediately
      makes **43 of the 48 `src/**/*.svelte` files** red (`npx prettier --plugin prettier-plugin-svelte --check
"src/**/*.svelte"` -> "Code style issues found in 43 files"). A 43-component whitespace reformat on a
      site whose poem/art markup is whitespace-sensitive must be its own gated item with a real markup review.
      Its gate when taken on: `npm run test:unit` (real components are rendered by `test/lib/Gallary/Gallery.test.ts`
      and `test/lib/Article/Article.test.ts`), `npm run check`, `npx tsc --noEmit`, and item 7's
      dev + preview 200/200/404 smoke.
- [x] 11. **Hygiene (DONE)**: `svelte-preprocess` removed from `devDependencies` - `git grep` found zero
      references, no config declares `preprocess` options, and `src/**/*.svelte` contains no `lang="..."`
      script/style blocks to need it. The scratch `effect-4.1.1.tgz` an earlier session had downloaded into
      the repo root was deleted. Gates unchanged green; nothing else touched.
- [x] 12. **Kit core chain (DONE)**: `@sveltejs/kit 3.1.1`, `svelte 5.57.3`, `svelte-check 4.7.8`,
      `typescript-eslint 8.72.1`, `effect 3.22.4`. **`typescript` stays at 5.9.3 on purpose**: Kit 3 declares
      `typescript ^6.0.0` and TS 6.0.3 compiles this app fine, but it breaks `effect@3` Schema inference -
      `npx tsc --noEmit` grew 14 real errors in `src/lib/editing/**`, byte-identical on `effect` 3.17.14 and
      3.22.4, so 5.9.3 is the load-bearing pin and `npm ls` marks the Kit peer `invalid` (accepted: installs
      are `--legacy-peer-deps`). Gate: tsc 0, check 0/0, eslint 0, prettier clean, 42/409.
- [x] 13. **ESLint 10 (DONE)**: `eslint 10.14.0`, `@eslint/js 10.0.1`, `globals 17.14.0`. The
      `typescript-eslint` 8.72.1 line already declares `eslint ^10.0.0`, and its parser peer
      `typescript >=4.8.4 <6.1.0` keeps 5.9.3 valid. The only fallout was core `no-useless-assignment` newly
      in `recommended`, which flagged 4 TRUE dead stores that got fixed rather than overridden: the
      `savedValue = toWebExperienceEditorValue(saved)` re-derivation in
      `src/routes/web-experience/edit/[...wid]/+page.server.ts` (the action closes with
      `throw redirect(303, ...)` and nothing reads `savedValue` after line 177 - the binding is now `const`),
      plus 3 dead initializers in `test/lib/article-logic.test.ts` now asserted as the pre-state instead of
      silently overwritten.
- [x] 14. **prettier-plugin-svelte 4 (DONE - and it closes item 10 as a phantom)**: 3.5.2 -> 4.1.1. Item
      10's premise ("declaring the plugin makes 43 of 48 `.svelte` files red") does **not** reproduce. Two
      measurements: (a) at item 13 the repo ran prettier 3.9.10 with plugin 3.5.2 in `node_modules` and the
      `plugins` entry item 9 added to `.prettierrc`, and `npx prettier --check .` was **green across all 48
      `src/**/*.svelte` files**; (b) an isolated copy of `src/**/*.svelte` + `.prettierrc` into
      `%TEMP%` with a fresh `prettier@3.9.10 + prettier-plugin-svelte@3.5.2` install also flagged **exactly
      1** file. The whole "43 files need a markup review" fear is stale. What the bump actually changed is
      one formatting disagreement: plugin 4 joins `></textarea>` onto the last attribute line where 3.5.2
      keeps the tag on its own line, so `src/lib/form/MarkdownEditor.svelte` needed 2 hunks (no poem/art
      markup reflowed) and the tree now matches 4.1.1. Plugin 3.5.2 declares peer `svelte ^4.2.7` - unmet
      under svelte 5 - while 4.1.1 declares `svelte ^5.0.0`, so this bump is **required** by the Kit3/Svelte-5
      line, not cosmetic. `src` holds 48 `.svelte` files (22 in `src/lib`), `test` holds none.
- [x] 15. **Test / DOM / runtime chain (DONE)**: `@testing-library/jest-dom 7.0.1`,
      `@playwright/test 1.64.1`, `happy-dom 21.0.4`, `jsdom 30.1.3`, `@types/node 26.6.6`, `qs 6.17.1`,
      `tslib 2.9.1`. `jsdom` is dead weight the way tests are configured (`vitest.config.ts`
      `environment: "happy-dom"`, and zero `@vitest-environment` docblocks in `test/**`) - it is bumped for
      tidiness, not because anything consumes it. Gate: 42 files / 409 tests, `tsc` 0, `check` 0/0.
      **Windows trap hit during this item**: an `npm install` pruned and rewrote
      `node_modules/$app/tsconfig.json` in a stale form, and `npx tsc --noEmit` exploded to 32 errors
      (`TS1343 import.meta` x many, `TS2307 aws-sdk`, `TS1192`) even though the shim file _existed_;
      `npx svelte-kit sync` fixed all 32 in one go, and `npm run check` was green throughout because it runs
      `svelte-kit sync` first. Always re-run `svelte-kit sync` before judging `tsc` after an install.

- [x] 16. **`effect` v3 -> v4 source migration (DONE at `610d5ec`, branch `kit3-effect4`)**:
      `effect 3.22.4` -> `4.1.1` (`package.json` now reads `^4.1.1`) with the v4 API rewrite spread over
      **31 files, +597/-689** (`git show --stat 610d5ec`): `src/lib/{api,error,file}.ts`,
      `src/lib/typing/{art,page,poem,strapi}.ts`, `src/lib/editing/core/{definitions,store.server}.ts`,
      the 5 resource schemas (`poems`, `quintuplapus`, `souljuicer`, `terms-of-service`, `web-experience`),
      4 route handlers (`poems/edit/[...pid]`, `terms-of-service/edit`, `the-quintuplapus/build/[bid]`,
      `the-souljuicer/build/[bid]`) and 11 test files. THE MAP BELOW WAS READ OFF THE `610d5ec` DIFF AND
      THE LIVE TREE - every count is a `git grep` total measured at HEAD, so each line is re-verifiable
      with one command:
      `Either` -> `Result`: `Either.isRight`/`isLeft` -> `Result.isSuccess`/`Result.isFailure`, and the
      success payload is the `.success` PROPERTY (`decoded.success` survives at
      `src/routes/poems/edit/[...pid]/+page.server.ts:93` and
      `src/routes/terms-of-service/edit/+page.server.ts:74`). `src/lib/editing/core/store.server.ts:34`
      replaced `decoded.right` with `Result.getOrThrow(decoded)`; `Result.succeed` is the constructor
      (`src/lib/file.ts:105`). `Schema.decodeUnknownEither(s)(x)` -> `Schema.decodeUnknownResult(s)(x)`
      (77 call + mock sites in `src`+`test`) - v4 returns the `Result` itself, so nothing is left to
      unwrap. `Effect.either(f)` -> `Effect.result(f)` (`src/lib/file.ts`, `test/{api,build,file}.test.ts`).
      160 `Result.isSuccess|isFailure|succeed|getOrThrow` occurrences now live in `src`+`test`.
      `Schema.Union(a, b)` -> `Schema.Union([a, b])`: the 2-argument overload is GONE; 6 array sites in
      `src` (`typing/art.ts:24,35`, `typing/page.ts:17`, `typing/poem.ts:13`, `typing/strapi.ts:22,27`).
      `Schema.extend(A, B)` is GONE (0 matches repo-wide) -> `Schema.Struct({ ...A.fields, ...B.fields })`,
      and the `.fields` accessor is live at 21 sites in `src` (e.g. `typing/page.ts:50-51` merges
      `...strapiMetaDataC.fields` with `...strapiDataArrC(strapiPageC).fields`; also `typing/strapi.ts:39`).
      Every 3-generic `Schema.Schema<A, I, R>` left the tree (`git grep 'Schema\.Schema<' -- src test` =
      0 hits today) -> `Schema.Codec<A, unknown>` (13 occurrences in 9 files), and the generic helpers
      shed their effect-context parameters: `withIdC = <A, I, R>(d: Schema.Schema<A, I, R>)` became
      `withIdC = <A>(d: Schema.Codec<A, unknown>)`, likewise `strapiDataC` and `strapiDataArrC`.
      `Schema.optional(X)` is **still the v4 spelling** (10 live sites: `souljuicer.ts` x3,
      `typing/art.ts` x3, `typing/page.ts` x4) - it needed no rewrite at all.
      **FOUR CLAIMS FROM THE MIGRATION BRIEF DID NOT REPRODUCE HERE - NEVER REPEAT THEM AS FACTS ABOUT
      THIS REPO**: a second generic parameter on `EditorDefinition` (the claimed form reads
      `EditorDefinition<A, F extends Record<string, unknown> & Record<keyof A, unknown>>`), a `validate` function returning `string | null`, a
      `values ?? createDefault()` -> `values as T` swap, and `Schema.optionalFrom`. Proof, all reproducible:
      `git log --all -S "F extends"`, `-S "Schema.optionalFrom"` and `-S "values ?? createDefault"` each
      return ZERO commits; `git grep -i validat -- src/lib/editing` = 0 hits and the same pickaxe over
      `src/lib/editing` history = 0 commits (the only `validate` text in the repo is poem _prose_ in
      `src/data/poems.json` and test _describe_ labels); `optionalFrom` has 0 matches in `src`+`test`;
      `createDefault` is still both an `EditorDefinition` field and the live fallback in every resource
      file (`poems.ts:54`, `quintuplapus.ts:79`, `souljuicer.ts:99`, `terms-of-service.ts:47`,
      `web-experience.ts:98`); and at `610d5ec^` `EditorDefinition` ALREADY read `EditorDefinition<A>`
      with `schema: Schema.Schema<A, unknown, never>`, so item 16's ENTIRE `definitions.ts` diff is the
      single line replacing that one `schema:` entry with `Schema.Codec<A, unknown>` - no generic change.
      A future session that "finds" those constructs is looking at a different tree; the rule (same as the
      esbuild/keepNames landmine) is to write a fact down only after reading it off THIS repo's own diff.
      GATE (all re-measured at `610d5ec`, 2026-11-01): `npx svelte-kit sync` silent; `npx tsc --noEmit`
      **0 errors**; `npm run check` **0 errors / 0 warnings**; `npx eslint .` 0 problems;
      `npx prettier --check .` clean; `npm run test:unit` **42 files / 409 tests** in **12.74 s**;
      `vite preview` over the fresh `.svelte-kit/output` served `/` 200 (24 740 B, `<h1>` rendered),
      `/poems` 200 (42 449 B, `<h1>`), `/no-such-route` 404; `npm run build` compiled BOTH bundles
      (client `1.60s`, server `605ms`) and then threw the item-2 Windows symlink EPERM. Residual v3 grep:
      `Either`, `Schema.extend`, `decodeUnknownEither`, `Effect.either`, `decodeUnknownSync` = 0 lines
      across `src`+`test`; the only `.right` left in `src` is a CSS class in `src/lib/arrow/Arrow.svelte:33`.
      `typescript` stayed 5.9.3 in this commit on purpose - item 12 always assigned the TS major to the
      effect-4 migration, and item 17 is where it actually happens.

- [x] 17. **`typescript` 5.9.3 -> `6.0.3` - CLOSED by this commit** (the last dependency item; note that this
      entry did not exist before 2026-11-01 - the header had been naming "item 17" with no matching checkbox).
      Install was `npm i -D typescript@6.0.3` (no `--legacy-peer-deps`), and `package.json` was then edited to
      pin the band: `"devDependencies": { "typescript": "^6.0.3" }` -> **`~6.0.3`**. A caret is NOT usable
      here: `^6.0.3` admits 6.1.0, which `@typescript-eslint/*@8.72.1` peer `typescript >=4.8.4 <6.1.0`
      forbids, so caret-installing 6.0.3 would re-create the peer violation this item is closing. The legal
      band is the intersection of kit 3.1.1's `^6.0.0` and that peer = **`>=6.0.0 <6.1.0`**, which `~6.0.3`
      means in practice (measured `npm view typescript@6 version` -> the 6.x line ends at `6.0.2`, `6.0.3`;
      `npm view typescript version` -> registry latest **7.0.2**, unreachable). `typescript@latest` remains a
      forbidden command. `package-lock.json` carries `+5/-25` under `git diff --numstat`, and `git diff -U0`
      explains the shape instead of guessing it: line 49's range mirror `"typescript": "^5.9.3"` ->
      `"~6.0.3"` (the lock MUST mirror `package.json` or `npm ci` aborts with `EUSAGE ... lock ... not
match`), the `node_modules/typescript` entry's `version`/`resolved`/`integrity` lines replaced by the
      6.0.3 tarball values, and 20 lone `"dev": true` lines deleted plus 1 `dev` -> `devOptional` flip -
      npm's own rewrite as the dev-and-optional `typescript` peer became satisfied across its dependent
      tree, not my edit. `npm ci` accepted the result, and `npm ls typescript` now prints kit's
      peer **satisfied with zero `invalid` markers** - `typescript@6.0.3 deduped` under `@sveltejs/kit@3.1.1`,
      `@typescript-eslint/*@8.72.1`, `svelte-check@4.7.8`, `typescript-eslint@8.72.1` and the root. That
      closes the noise label the item-15 fact bullet used to call permanent.
      **ROOT CAUSE, proven by stashing the swap and re-running instead of assuming:** `npx tsc --noEmit -p
tsconfig.json` on 6.0.3 printed **13 errors**, and they are strict-null sites, not TS-6 inference
      damage and not effect/`Schema` leftovers (item 16 already moved every schema to
      `Schema.Codec<A, unknown>`; zero effect-related diagnostics survive). Cross-version probes: TS 5.9.3 +
      `strictNullChecks: true` -> the **identical 13**; TS 6.0.3 + `strictNullChecks` off -> **0**; and the
      chain was read in full - root `tsconfig.json`, `.svelte-kit/tsconfig.json` and
      `node_modules/$app/tsconfig.json` - **none of the three declares any strict key**, so strict mode has
      been active here since TS 5.9.3 and the 13 were always latent. The decisive probe: `npx tsc
--showConfig -p tsconfig.json` with the flag unset prints **no strict keys at all**, while with
      `strict: false` inserted the same command materializes NINE keys: `strict`, `noImplicitAny`, `noImplicitThis`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `useUnknownInCatchVariables` - each one printed `false`, and
      the four-name draft this bullet first carried (`strict`, `noImplicitAny`, `strictNullChecks`, `useUnknownInCatchVariables`) UNDERCOUNTED the probe: the measured output also carries `noImplicitThis`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization` and `strictBuiltinIteratorReturn`, and nine keys is the true count of what never existed in the
      old chain, which is why TS 6 ships strictness as a compiler built-in rather than as a config value.
      **Decision made this item (the user's choice): the pin-loose path** - keep TS 6.0.3 and write the
      literal line `"strict": false` into root `tsconfig.json` as the FIRST key of `compilerOptions`, written immediately before `allowJs` and `checkJs` (order proven with `Get-Content -LiteralPath tsconfig.json -TotalCount 8`), so the
      strictness flags are explicit and the next major cannot silently re-tighten them; the strict debt is
      carried by a new item instead (see item 19). A probe `tsconfig.nonull.json` was created in the repo
      root, used once, and deleted inside the same command string (protocol 1: no scratch files;
      `git status --short` stayed at 3 modified files, and no probe file under `.svelte-kit/**` was ever
      touched). `git diff --numstat` for this item: `tsconfig.json` 1 insertion / 0 deletions,
      `package.json` 1/1, `package-lock.json` 5/25.
      **GATE battery, re-measured in this tree (HEAD `0a3fba1` + `package.json` + `package-lock.json` +
      `tsconfig.json`):** `npx svelte-kit sync` silent; `npx tsc --noEmit -p tsconfig.json` **0 errors**;
      `npm run check` **0 errors / 0 warnings**; `npm run test:unit` **42 files / 409 tests**; `npx eslint .`
      0 problems; `npx prettier --check` clean on the 3 modified files; `npm run check:encoding` green
      ("no known corruption patterns found in live src/data JSON files"); `npx vite build` compiled BOTH
      bundles and then threw the **byte-identical item-2 Windows symlink EPERM** (`EPERM: operation not
… symlink '![-]\catchall.func' -> ..\functions\index.func`, `node_modules/@sveltejs/adapter-vercel/
index.js:316`) - the bundle gate is green and the artifact gate is untouched, item 2 stays open;
      `vite preview` on the fresh `.svelte-kit/output` served `/` **200**, `/poems` **200**, `/poems/`
      **308 -> 200**, `/the-quintuplapus` and `/the-quintuplapus` + edit **200**, `/no-such-route` **404**.
      Rollback = `npm i -D typescript@5.9.3` + one revert, and the `strict: false` line must revert in the
      same commit. The commit carrying this item is the single `KIT3(item-17)` line in
      `git --no-pager log --oneline -3` (committed 2026-11-02; its id, author date and author/committer
      emails are read with `git --no-pager log -1 --format='%h %ai %an %ae %cn %cE'` - this entry cannot
      self-cite its own id because its text is part of that commit).

- [ ] 18. **Playwright e2e gate (OPEN, config-only; this entry also did not exist before 2026-11-01)**:
      `playwright.config.ts` is 10 lines today - NO `testDir` (the default is the config file's own directory, so
      it scans from the repo root, and Playwright only auto-ignores `node_modules` and `.git`), NO `testMatch`, NO
      `testIgnore`, and `webServer.command: "npm run build && npm run preview"`, which is the item-2
      symlink-EPERM build. The result, measured: Playwright collects the Vitest tree (`test/**/*.test.ts`) as if
      it were its own suite and dies with `Vitest mocker was not initialized in this environment. vi.queueMock()
is forbidden` at `test/lib/analytics-simple.test.ts:4`, while `git ls-files` shows the repo has ZERO
      `.spec.ts` files - Playwright has never had a green baseline here. Fix shape: `testDir: "./e2e"` plus a
      `testMatch` over `*.spec.ts`, a `webServer` whose command is the gate that actually works on this box
      (`npx vite build` then `npx vite preview --port 4173`), ONE baseline `e2e/smoke.spec.ts` asserting `/` and
      `/poems` respond 200 with SSR'd `<h1>` markup and a bogus route 404, and root `tsconfig.json`
      `include: ["src", "test", "e2e", "*"]` so `tsc` type-checks the new folder. Vitest is already safe without
      being touched: `vitest.config.ts:10` pins `include: ["test/**/*.{test,spec}.{js,ts}"]`, so a new top-level
      `e2e/` folder is outside its collection by construction - verify that instead of "fixing" it. Honest limit:
      on this box the e2e run inherits item 2's blocked artifact gate, so a green e2e proves the `vite build` +
      `vite preview` route, not the adapter-vercel artifact.

- [ ] 19. **TypeScript strict adoption (OPEN - opened by the item-17 commit as the debt that `strict: false`
      pins rather than pays)**: with that line in place, `npx tsc --noEmit` and `npm run check` are both **0**.
      Deleting the line (TS 6 then applies its built-in strict defaults) or flipping `strictNullChecks` alone
      reproduces **37 diagnostics in 14 files** - the 13 `tsc`-visible ones plus 24 that plain `tsc` cannot
      see. **The 13 (`tsc` visible)**: `src/routes/+page.server.ts` 5 (indices on `readonly` page-detail
      arrays), `src/routes/the-quintuplapus/[...aid]/+page.server.ts` 1 (`Property 'id' does not exist on type
'never'`), `src/lib/image.ts` 1 (`'pd.data' is possibly 'null'`), `src/lib/editing/resources/quintuplapus/quintuplapus.server.ts`
      `souljuicer.server.ts` `web-experience.server.ts` 1 each (the same `UploadFileFn` signature mismatch),
      and `test/lib/editing-web-experience.test.ts` 2 + `test/lib/s3.test.ts` 1 (`No overload matches this
call`). **The 24 (visible only to `svelte-check`)** in 6 components: `src/lib/Gallary/Nav.svelte` 9,
      `src/lib/SubNavWrap.svelte` 5, `src/lib/Gallary/Item.svelte` 4, `src/lib/Article/Nav.svelte` 4,
      `src/routes/+page.svelte` 1, `src/lib/editing/core/EditorShell.svelte` 1. Classes: `possibly 'null'` 12,
      `Type 'number | undefined' is not assignable to type 'number'` 12, `Property '0' … on type 'readonly …'`
      5, `UploadFileFn` 3, `boolean | undefined` -> `boolean` 2, `null` -> `string` 1, `'id' on 'never'` 1,
      `No overload matches this call` 1. **Two traps to keep in mind when this item is attempted.** (a) The
      half-strict probe (all strictness ON, `strictNullChecks` OFF) produced **106** errors, 104 of them
      implicit-any findings inside `test/lib/typing-*.test.ts` - a worse state than either extreme, so
      "turn strict on" must be planned together with the implicit-any debt, not as a one-line flip.
      (b) `erasableSyntaxOnly` adds **0** errors here (dead flag - never re-explain a strict error as "TS 6
      inference damage"; the 13 are all null/index-signature sites). Fix shape must not be guessed: read the
      `UploadFileFn` declaration in `src/lib/editing/**`, decide whether the page-detail arrays get an index
      signature or the callers get a narrow, and treat `attributes.image.data` as a typed-narrowing problem in
      `image.ts`/`Gallary/*`, not as 12 separate `!` insertions. Rollback = restore the `strict: false` line.

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
- **npm audit verdict (measured with `npm audit --json`, `npm audit --omit=dev`, `npm audit fix --dry-run`)**:
  the 21 advisories are 5 leaves plus 16 chain-only nodes. `eslint`, `@eslint/js`,
  `@eslint-community/eslint-utils`, `@typescript-eslint/*`, `typescript-eslint`, `eslint-config-prettier`,
  `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, `@sveltejs/adapter-auto`, `@sveltejs/adapter-vercel` and
  `@vercel/nft` are reported ONLY as dependents of a vulnerable package, so no version of any of them fixes
  anything. Production contains exactly 2 (both moderate): `aws-sdk` GHSA-j965-2qgj-vjmq, plus the `uuid`
  8.0.0 that `aws-sdk` pins exactly (GHSA-w5hq-g745-h8pq). `npm audit --omit=dev` therefore reports
  2 moderate vulnerabilities and nothing else.
- **Why the three dev-only leaves have no forward-eligible release**: `deepmerge` GHSA-gcqx-w48m-w2h4 is
  already at 4.3.1 (the newest published) and the advisory range `>=4.2.0` has no fixed version; `glob`
  GHSA-3g3m-2fjr-6pw4 is patched only above 14.0.1 (latest 14.0.3) while `@vercel/nft`, newest 1.11.0, pins
  `glob: ^13.0.0` and the 13.x line ends at 13.0.6; `minimatch` GHSA-g3hv-75wg-m249 is patched at 11.0.1
  through 11.0.4 (engines `node 20 || >=22`, so local Node qualifies) but `@eslint/config-array` pins
  `minimatch ^10.2.4` and `@typescript-eslint/typescript-estree` 8.72.1 pins `^10.2.2`. `npm audit fix`
  without `--force` resolves ZERO of the 21: the measured dry-run delta is 25 platform-optional binaries
  added (`lightningcss-*`, `@rolldown/binding-*`, `fsevents`) plus a phantom `remove $app undefined`, and the
  21 survive unchanged. Every `--force` candidate is a downgrade - `aws-sdk@1.18.0`, `@sveltejs/kit@0.0.30`,
  `@sveltejs/adapter-vercel@5.6.2`, `typescript-eslint@8.14.0`.
- **The single forward-facing remediation, and the real cause of the adapter-vercel EPERM**: `aws-sdk` `latest`
  is 2.1693.0 - already what we have - so v2 has no upgrade path, and GHSA-j965-2qgj-vjmq says verbatim "add
  validation to the region parameter value in or migrate to v3". `@aws-sdk/client-s3` 3.1161.0 and
  `@aws-sdk/lib-storage` 3.1161.0 (needed because `src/lib/s3.ts` calls `s3.upload`, which v3 core drops)
  contain no `uuid` dependency at all, so that migration removes BOTH production advisories. Blast radius
  measured: `src/lib/s3.ts` is the repo's only `aws-sdk` import, used by 4 server modules
  (`quintuplapus.server.ts`, `souljuicer.server.ts`, `web-experience.server.ts`, `+layout.server.ts`) and by
  `test/lib/s3.test.ts`, which mocks `#lib/s3` and needs no change; only `getObject`, `upload` and
  `deleteObject` are used, and the region advisory cannot fire in this app because `getS3Config()` reads the
  region from `AWS_REGION` / `VITE_AWS_REGION` / `us-east-1`, never from request input. The other forward
  action is a Node minor upgrade: `node --version` is 22.17.0 while `jsdom` 30.1.3 requires
  `^22.22.2 || ^24.15.0 || >=26.0.0` and `undici` 8.12.3 requires `>=22.19.0`, which 22.22.x satisfies
  inside `package.json`'s own `22.x` range. The item-2 EPERM is a Windows privilege requirement, not a Kit or
  adapter defect: `whoami /groups` sits at Medium Mandatory Level and a `%TEMP%` probe of
  `New-Item -ItemType SymbolicLink` failed with `NewItemSymbolicLinkElevationRequired`, so adapter-vercel's
  unconditional `fs.symlinkSync` at `index.js:316` needs an elevated shell or Developer Mode - and there is
  nothing newer to test, since adapter-vercel `latest` 7.0.2 and `@vercel/nft` `latest` 1.11.0 are already
  installed.

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

## Current measurements (2026-11-02, re-measured in the item-17 tree: HEAD `0a3fba1` plus the 4 files item 17 touches - THE LIVE TABLE)

| Measurement                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx svelte-kit sync`                                  | Zero warnings (re-run 2026-11-02 with `typescript@6.0.3` installed, exit 0). **Must be re-run after every `npm install`** - see the item-15 fact below. Peer-closure proof is now positive, not tolerated noise: `npm ls typescript` prints 12 `typescript` lines - 11 of them `typescript@6.0.3 deduped` (kit, svelte-check, typescript-eslint + parser + plugin + their sub-packages, ts-api-utils) plus the root install - and **not one `invalid` marker**, so the `typescript@5.9.3 deduped invalid: "^6.0.0" from node_modules/@sveltejs/kit` line this file used to treat as permanent is gone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npx tsc --noEmit -p tsconfig.json`                    | **0 errors** on `typescript@6.0.3` (it reads `node_modules/$app/tsconfig.json`) with `"strict": false` written into root `tsconfig.json` by item 17. Delete that single line and the same command prints **13** strict diagnostics; `svelte-check` on the identical probe prints **37** - item 19's inventory.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run check`                                        | **0 errors, 0 warnings** (`svelte-check found 0 errors and 0 warnings`, 2026-11-02). The 13-versus-37 split that item 19 inherits is invisible to THIS gate - it only shows up when a strict probe is written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run lint` (= `prettier --check . && eslint .`)    | Green end to end. prettier now really parses all 48 `src/**/*.svelte` components (plugin 4.1.1) and they are canonical; `eslint .` = 0 problems on ESLint 10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run test:unit`                                    | **42 files / 409 tests** passed, **12.00 s** (re-measured 2026-11-02 in the item-17 tree; vitest 5 splits it as environment 53%, setup 34%, import 7%, tests 4%, worker 1%).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run build` (re-measured 2026-11-02)               | Both bundles compiled by `vite build` (client `620 ms`, server `519 ms`), then adapter-vercel threw the item-2 Windows symlink EPERM on `![-]\catchall.func -> ..\functions\index.func` and exited 1. Fresh 2026-11-02 log line-for-line: `✓ built in 620ms`, `✓ built in 519ms`, `> Using @sveltejs/adapter-vercel`, `Error: EPERM: operation not permitted, symlink`, `at Object.symlinkSync (node:fs:1885:11)`, `@sveltejs/adapter-vercel/index.js:316:9`, `errno: -4048`, `syscall: 'symlink'` - the same fields as the `610d5ec` run under TypeScript 5.9.3, only the bundle times moved, so the TS major did not touch this gate. **Bundle gate GREEN, artifact gate BLOCKED**: `.vercel/output` holds `static/` (8 entries, no `index.html`) and a partial `functions/`, but `config.json` and `functions\index.func` are absent - the artifact gate is `.vercel/output/**`, there is no root `build/`. Local substitute gates are `npx vite build` + `npx vite preview --port 4173`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npx vite preview` (re-measured 2026-11-02, port 4179) | `/` **200** (24 740 B, `<h1>` server-rendered), `/poems` **200** (40 891 B - the 42 449 B once recorded at `610d5ec` is superseded), `/the-quintuplapus/souljuicer` **200** (64 953 B), `/poems/` **308** with a 0 B body (Kit 3.1's trailing-slash redirect - visible only because every probe used `-MaximumRedirection 0` on `localhost`, never `127.0.0.1`), `/definitely-not-a-page` **404** (0 B body). All five probed 2026-11-02 against a preview started straight from `node_modules\vite\bin\vite.js` on port 4179. The Kit 3 preview tree `.svelte-kit/output/client` + `.svelte-kit/output/server` (no root `index.js`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `vite dev` smoke (re-measured 2026-11-01)              | `VITE v8.3.5 ready in 2393 ms`; `/` 200 (71 350 B), `/poems` 200 (102 224 B), `/no-such-route` 404.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run check:encoding`                               | Green (`no known corruption patterns found in live src/data JSON files`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm outdated` (re-run 2026-11-02, exit 1)             | **Two rows** on 2026-11-02 - and `npm outdated` EXITS 1 whenever it prints any row, so a red exit code from it is not a gate failure: `typescript` Current `6.0.3` / Wanted `6.0.3` / Latest `7.0.2`, i.e. the `~6.0.3` band pin is what holds the Wanted column down, while 6.1.0 and 7.x stay unreachable because `@typescript-eslint` 8.72.1 prints peer `typescript: ">=4.8.4 <6.1.0"` on `parser`, `eslint-plugin`, `project-service`, `tsconfig-utils`, `type-utils`, `typescript-estree`, `utils` **and** the `typescript-eslint` umbrella (eight peer rows read out of `package-lock.json` with `Select-String -LiteralPath`), with `@sveltejs/acorn-typescript@1.0.13` wanting `"^6.0.0"`; exactly one installed copy, whose lockfile header line reads `node_modules/typescript` resolved to `typescript-6.0.3.tgz`, is what makes `npm ls` clean. And `effect` Current `4.1.1` / Wanted `4.1.2` / Latest `4.1.2` - a patch published AFTER item 16 installed `^4.1.1`, so this row's old "CLOSED by item 16" label is superseded: the caret already admits 4.1.2, and `npm update effect` would rewrite the lockfile only. `typescript@latest` must NEVER be the install command. Everything else wants = latest, including the exact-pinned `aws-sdk 2.1693.0`, `mixpanel-browser 2.84.0`, `@testing-library/svelte 5.4.2`, `@testing-library/user-event 14.6.8`, `@types/qs 6.15.1`, `save 2.9.0`, `@fontsource/fira-mono 5.3.0`, `hamburgers 1.2.1`. |
| `npm test` (Playwright e2e)                            | **Not a working gate in this repo, and it never was** - pre-existing, not caused by the 1.55 -> 1.64 bump. `playwright.config.ts` declares no `testMatch`/`testIgnore`, so Playwright globs `test/**` and loads Vitest files (`Vitest mocker was not initialized in this environment. vi.queueMock() is forbidden` at `test/lib/analytics-simple.test.ts:4`), while `test/` contains **0 `.spec.ts`** files (only `lib/` + `routes/`). Its `webServer.command` is `npm run build && npm run preview`, and `npm run build` is still the adapter-vercel Windows symlink EPERM blocker (item 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Working tree                                           | Clean after each item commit; no scratch files (the `%TEMP%` prettier probe and the `.h.mjs` heading probe were each deleted the moment they were consumed, which protocol 1's no-scratch-files rule requires). Item 17's close-out commit carries four files, not one: `tsconfig.json` (1 insertion / 0 deletions), `package.json` (1/1), `package-lock.json` (5/25, npm's own rewrite - see the item-17 facts bullet below) and this checklist. `git status --short` lists exactly those four modified paths and zero untracked ones, which protocol 1's no-scratch-files rule requires - every probe written during item 17 (`tsconfig.nonull.json` in the repo root, the `%TEMP%` `--showConfig` probe, each captured gate log) was deleted the moment it was consumed, and a fresh `Get-Content`-based line count plus `git status` was re-run before this row was rewritten. The ignored `docs/` tracker cannot be staged, because `git add docs/` is a no-op                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Hard-won facts added by items 11-15 (2026-11-01)

- **`npx svelte-kit sync` after every install, before judging `tsc`.** During item 15 an `npm install` left
  `node_modules/$app/tsconfig.json` present-but-stale, and `npx tsc --noEmit` threw a **32-error wall**
  (`TS1343` "import.meta is only allowed when --module is es2020+", `TS2307` cannot find `aws-sdk`, `TS1192`)
  that looked like package damage and was pure tsconfig staleness. `npm run check` stayed green the whole
  time because its script is `svelte-kit sync && svelte-check`. `"postinstall": "svelte-kit sync"` IS wired
  into `package.json` and it still did not prevent this. One command clears it: `npx svelte-kit sync`.
  Never debug tsconfig/imports/sdk typings out of that symptom.
- Kit 3 wants `typescript ^6.0.0`; ~~`npm ls` prints `typescript@5.9.3 deduped invalid: "^6.0.0" from
node_modules/@sveltejs/kit` - permanent, accepted noise. TS 6.0.3 gives 14 genuine `tsc` errors in
  `src/lib/editing/**` `Schema` inference, identical on effect 3.17.14 and 3.22.4, and TS 7.0.2 is now the
  registry latest, so **5.9.3 stays pinned until `effect` v3 -> v4 is migrated as its own item**. That
  migration is the only remaining dependency work on this branch.~~ SUPERSEDED by item 17: `typescript@6.0.3`
  is installed with the band pin `~6.0.3`, kit's `^6.0.0` peer is SATISFIED, `npm ls typescript` prints
  **zero `invalid` markers** anywhere, and the 14 editing errors the bullet predicted had already vanished via
  item 16. What replaced them were 13 strict-null sites (item 17), then 0 once `strict: false` was written
  down explicitly - see item 17's entry and item 19 for the strict debt.
- `prettier-plugin-svelte@3.5.2` declares peer `svelte ^4.2.7`; `4.1.1` declares `prettier ^3.0.0`,
  `svelte ^5.0.0`, node `>=20`. Under svelte 5, only 4.1.1 is the honest pairing. The two versions disagree
  about markup closing tags: **3.5.2 wants the `>` of `></textarea>` on its own line, 4.1.1 joins it to the
  end of the last attribute line**. The repo now follows 4.1.1, so do not "restore" the 3.x shape - it would
  redden `npx prettier --check .` again.
- Isolated prettier probe recipe: new `%TEMP%` dir, `robocopy src <temp>\src *.svelte /S` (**PowerShell
  `Copy-Item -Recurse -Filter` flattens the directory tree and cannot create it**), copy `.prettierrc`,
  `npm i --no-save prettier@3.9.10 prettier-plugin-svelte@3.5.2 svelte@5.57.3`, then
  `node_modules\.bin\prettier.CMD "src/**/*.svelte" --check`. Gotcha: materialising a git blob with
  `git show ... | Out-File -Encoding utf8` (Windows PowerShell 5.1) writes a **BOM** and rewrites LF to CRLF,
  which can produce false prettier warnings - use `Start-Process -RedirectStandardOutput` to write raw bytes.
- Playwright in this repo has never had a green baseline: `playwright.config.ts` sets no `testMatch` /
  `testIgnore`, so it globs `test/**` and tries to run **Vitest** files through its own runner, and `test/`
  has no `.spec.ts` files at all. Fixing the e2e gate is a config item (give Playwright its own
  `testMatch` for `*.spec.ts` under a new `e2e/` folder, and a `webServer` that does not need the
  symlink-blocked `npm run build`), not a version-bump item.
- ESLint 10 core `no-useless-assignment` lands inside `recommended`, so upgrading ESLint silently adds
  findings on code that linted clean before. Treat them as real dead code and fix the code (that is what
  item 13 did), do not switch the rule off.

## Hard-won facts added by item 16 (2026-11-01, at `610d5ec`, branch `kit3-effect4`)

- **`Schema.Codec<A, unknown>` is the reason item 12's 14 `editing/**` `tsc` errors existed.** A v4 `Codec`
  is `unknown -> A`: the decoded value takes the TARGET type and the input side is `unknown`, while the old
  3-generic `Schema.Schema<A, I, R>` under TS 5.9 + effect 3 collapsed `EditorDefinition`'s
  `values` / `createDefault` / `initial` into `any` - which is why `values.id` was legal as a lie. Under the
  v4 `Codec` the same lines become real `T`-shaped mismatches, so the effect rewrite and the TypeScript
  major MUST land in that order (item 16 first, then 17) and never as one commit.
- **A mock must stub the NEW name or it silently un-stubs the real one.** A `vi.mock` factory that spreads
  `...actual` replaces only what it NAMES. A route test that kept stubbing the removed v3
  `decodeUnknownEither: () => () => ({ _tag: "Right", right: {...} })` after the route itself moved to
  `Schema.decodeUnknownResult` left the REAL decoder running against half-stubbed `Schema` machinery, and
  the suite died far from the cause with `TypeError: Invalid value used as weak map key`. The v4 mock has
  to name `decodeUnknownResult` and build its value with the REAL Result - `actual.Result.succeed({...})`
  at `test/routes/poems-edit-page.server.test.ts:118,192` - because the caller narrows with
  `Result.isFailure`, and a hand-rolled tag object is exactly the lie that narrowing catches.
- **`Result` reads nothing like `Either`:** the success payload is the `.success` PROPERTY, failures narrow
  via `Result.isFailure` / `Result.isSuccess`, `Result.getOrThrow` collapses a failure into a throw (the
  `editing/core/store.server.ts` idiom), `Result.succeed` is the constructor, and the wrapper helper is
  `Effect.result` where v3 had `Effect.either`.
- **Four item-16 claims from the upstream write-up do not exist in this repo** (a second
  `EditorDefinition<A, F extends ...>` generic, a `validate` returning `string | null`,
  `values ?? createDefault()` -> `values as T`, `Schema.optionalFrom`). The zero-hit probes are spelled out
  inside the item-16 entry so a later session can re-run them instead of re-litigating them, and
  `Schema.optional` turns out to be valid v4 (10 live sites, untouched). Re-learned rule: record a fact only
  after reading it off this repo's own `git show <sha>` - a changelog is a guess about YOUR tree.
- **`docs/` is UNTRACKED - `git add docs/...` does nothing, and the "single source of truth" claim inside
  `docs/SVELTEKIT_3_MIGRATION.md` is STALE.** `.gitignore` line 8 is `/docs` (probe:
  `git check-ignore -v docs/SVELTEKIT_3_MIGRATION.md` prints `.gitignore:8:/docs`), and
  `git ls-files "*.md"` lists only the five root files (`README`, `MIGRATION_SUMMARY`, `CONTENT_EDITING_PLAN`,
  `ENV_EDITOR_FINDINGS`, `MIGRATION_KIT3_CHECKLIST`). That tracker's `## Ground truth (verified 2026-10-30)`
  section still lists "two warnings the build prints now (must fix)" and "two hand-rolled files to delete",
  both long since resolved by items 8 and 11, and it contains no mention of effect, TypeScript or Playwright
  at all (measured: `Select-String -Pattern 'effect'` against it = 0 hits). A corrective banner was appended
  to its header on 2026-11-01; it cannot be committed because the folder is ignored. This file is the live one.
- **Items 17 and 18 had NO checklist entries until 2026-11-01.** The header had been writing "now item 17"
  and "now item 18" for several sessions, and the item-16 entry referred to item 17, but no checkbox line
  existed anywhere in the file - `Select-String -Pattern '\[ \]'` returned zero open items. A fresh session
  therefore could not tell what those two items require. Both entries now exist above, written from
  `npm view` peer data, the 10-line `playwright.config.ts`, `vitest.config.ts:10` and the empty
  `git ls-files | Select-String '\.spec\.'` probe. Lesson: renaming items in the header without creating their
  entries is a silent hole, and the fix is to grep for the checkbox, not trust the header.
- **PowerShell console output re-renders this repo's valid UTF-8 as junk, and that caused a false corruption
  alarm.** `Get-Content`, `Select-String` and `git grep` displayed the file's `U+00B7` and `U+2192` as a
  capital-A-with-circumflex followed by punctuation noise, because the console decodes UTF-8 through a legacy
  codepage. Byte evidence (2026-11-01, HEAD vs working tree, IDENTICAL multisets): `U+2713` x8, `U+2705` x3,
  `U+00B7` x1, `U+2192` x1, `U+00C2` x0. So the checklist never had mojibake in it, and the only two
  non-ASCII-punctuation sites are line 3 (the middot) and line 52 (the arrow in the status table, "403 when
  ENABLE_CONTENT_EDITOR=false arrow 404 when true"). Verify with the Read tool, or set
  `[Console]::OutputEncoding` to UTF-8 first, before ever "fixing" encoding.
- **Every array item of one `run_commands` call is executed in its OWN shell, so a formatter and a commit in
  the same batch race.** Measured on 2026-11-01: a batch that put `prettier --write` in one item and
  `git add` plus `git commit` in another produced a commit that still carried the OLD table-cell padding of a
  live-table row, while the canonical shortening landed only in the worktree, so the post-commit
  `git status --short` reported that file modified and `git diff --numstat` showed 1 insertion plus 1 deletion.
  The fix, and it is a protocol rule: formatter, `git add` and `git commit` must live in ONE command string
  inside ONE array item so they share a single shell, and the commit is then verified with
  `git diff --numstat HEAD` returning EMPTY. A `prettier --write` run that prints `(unchanged)` is the
  convergence proof, and `git commit --amend --no-edit` is the correct repair for a private unpushed commit.

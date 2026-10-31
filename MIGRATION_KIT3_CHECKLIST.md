# SvelteKit 2 -> 3 migration checklist

Branch: `sveltekit-migration-3x` · Stable commit: `410fcb8` (working tree clean; parent `a6fe9a9`)
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

## Current measurements (2026-10-31, at 410fcb8)

| Measurement | Result |
|---|---|
| `npx svelte-kit sync` | only 2 warnings: `config_option_deprecated_alias`, `tsconfig_invalid` (Windows false positive) |
| `npx tsc --noEmit -p tsconfig.json` | **83** errors; `TS2307` / `Cannot find module` = **0** |
| `svelte-check` | **94** errors, 0 warnings, in 15 files; CFM = **0** (was 302 -> 98 -> 94) |
| `vite dev` | ✅ `ready in 1806 ms`; `/` 200 (71 KB), `/poems` 200 (90 KB), bogus route 404 |
| `vite preview` on `.svelte-kit/output` | ✅ `/` 200 (24.7 KB, `<h1>` SSR'd), `/poems` 200 (37.4 KB), bogus 404 |
| Editor env gate (`$app/env/private`) | 403 when `ENABLE_CONTENT_EDITOR=false` → 404 when `=true` |
| `npm run build` | Vite compiles BOTH bundles cleanly (`349` server + `897` client modules, `built in ~650-870 ms`); adapter-vercel then hits **Windows symlink EPERM** (item 2) -> exit 1. Needs Developer Mode/admin |
| `npm run test:unit` (vitest) | ✅ **42 test files / 409 tests passed**, 9.37 s |
| Working tree | clean after each item commit (protocol 4); no scratch files left |

## Historical baseline (measured at a6fe9a9 - superseded by the table above)

| Measurement | Result |
|---|---|
| `npm run build` | **EXIT 0**, "built in 825ms" - Kit 3 + Vite 8 + Svelte 5 compile fine |
| `build/` output dir | **ABSENT** (only `.svelte-kit/output/{client,server}`) -> `npm start` + Vercel broken |
| `adapter_missing` warning | **PRESENT** - the adapter is never applied |
| `svelte-check` diagnostics | **98** (was 302 before Kit options moved into `sveltekit()`) |
| `Cannot find module` count | **2** (was ~250) - both are `$env/dynamic/private` |
| Kit warnings seen | `config_option_deprecated_alias`, `tsconfig_invalid` ("paths" overwritten), and 3x `tsconfig_extends_missing` during build (names root `tsconfig.json`) |

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
    `build.rollupOptions` is a *deprecated alias* of `build.rolldownOptions` (index.d.ts:3626-3633).
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
- [ ] 5. **tsc's 83 non-CFM errors**: mostly `test/lib/api.test.ts` TS2345 `unknown` ->
  `Schema<unknown, unknown, never>` (zod 4 + `src/lib/api.ts`) and missing `vi`/`vitest` globals in
  `test/**`. Buckets need a proper categorize pass.
- [ ] 6. **vitest config**: `vitest.config.ts` calls `sveltekit()` with NO Kit options and aliases
  `$app` -> `.svelte-kit/runtime/app` (a Kit 2 path Kit 3 no longer emits). It also aliases `$lib`/`$data`
  through `resolve.alias`, which Kit 3 ignores for its GENERATED tsconfig paths but which still works for
  vitest's runtime resolution. `test/setup.ts` mocks `$app/environment`, `$app/navigation` and `$app/stores`
  (the last one is a removed Kit 3 module).
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
- [ ] 8. **Cleanup leftovers**: `#lib`/`#data` subpath imports via package.json `imports` to retire
  deprecated `config.alias` (that leaves ZERO Kit warnings); verify then remove root junk `index.ts` +
  `test-mkkey.js`. ALREADY DONE here: `svelte-kit package` script deleted, `start` -> `vite preview`,
  adapter-auto moved to devDependencies, all scratch capture files deleted.
  STILL OPEN: `@vitest/ui@3.2.4` and `@vitest/coverage-v8@3.2.4` require vitest exactly `3.2.4` while
  vitest 5.0.5 is installed, so `test:unit:coverage` / `test:unit:watch` are peer-broken (own step).

## Hard-won facts (do not re-derive these)

- Kit 3 writes the generated tsconfig + `paths` to `node_modules/$app/tsconfig.json`.
  `.svelte-kit/tsconfig.json` is an EMPTY stub (`{"compilerOptions":{},"include":[],"exclude":[]}`) -
  never extend it, that was the whole `$lib` breakage.
- Kit's `tsconfig_invalid` / `"paths" was overwritten` warning is a **Windows false positive**:
  `write_tsconfig/validate.js` + `get_paths` compare backslash-absolute expected paths against
  forward-slash TS-resolved paths. Proof: `npx tsc --traceResolution` says
  `Module name '$lib/date' was successfully resolved to .../src/lib/date.ts`.
  DO NOT rewrite `paths` in `tsconfig.json`: probe-verified that `{"$lib/*": ["./src/lib/*"]}`
  without `baseUrl` resolves to NONE, and adding `baseUrl: "."` breaks the inherited Kit paths.
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
  `scripts/_tsprobe.cjs` are deleted; `scripts/` now holds only real tooling like `.eslintrc.cjs`).
  If a session recreates them, delete them before committing.
- Kit 3.1.0 peers: `typescript ^6.0.0` and `@opentelemetry/api` are `optional: true` in
  peerDependenciesMeta, so remaining on typescript 5.9.2 is fine (svelte-check 4.3.1 peer `>=5.0.0`).
  Required peers: `vite ^8.0.12` (8.3.5 ✓), `svelte ^5.57.1` (5.57.2 ✓),
  `@sveltejs/vite-plugin-svelte ^7.0.0` (7.3.1 ✓ installed at `410fcb8`). vitest 5.0.5 peer
  `vite ^6.4.0 || ^7.0.0 || ^8.0.0` ✓. Kit also depends on `@rolldown/pluginutils ^1.0.1`
  (vite 8.3.5 is rolldown-based; vite-plugin-svelte prints an "experimental vite 8" warning).
- `src/env.ts` validators MAY be plain functions - `EnvVarConfig.schema` is
  `StandardSchemaV1<string|undefined,T> | ((value: string|undefined) => T|undefined)` and Kit wraps
  plain functions via `normalize_env_schema` (`src/exports/env/index.js`). No zod needed.

- `$lib` strategy = HYBRID: keep `alias: { $lib: './src/lib', $data: './src/data' }` in `sveltekit()`
  (Kit's own sanctioned escape hatch) to reach green, then do the `#lib` codemod as item 8.
  `alias` is deprecated in Kit 3.1 (`src/core/config/options.js:56`), so it is temporary.
- `tsconfig_invalid` is PROVEN noise (see the Windows-false-positive fact above + `tsc --traceResolution`),
  so never "fix" `paths`. The old "treat as likely noise until proven otherwise" note is superseded, and
  the probe script it referred to (`scripts/_tsprobe.cjs`) has been deleted.

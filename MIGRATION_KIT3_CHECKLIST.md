# SvelteKit 2 -> 3 migration checklist

Branch: `sveltekit-migration-3x` · Stable commit: `a6fe9a9` (working tree clean)
Installed: `@sveltejs/kit@3.1.x`, `vite@8.3.5` (beta/rolldown), `svelte@5.57`, `vitest@5`

## Protocol (read this first on every new session)

1. Read this file + `git --no-pager log --oneline -8` + `git --no-pager diff HEAD@{1} --stat`.
   Do NOT re-read `vite.config.js` / `tsconfig.json` / Kit source unless the diff says they changed.
2. Work ONE checklist item at a time. Do not start the next item before its gate passes.
3. Verification gates (these exact commands are already validated - do not rediscover them):
   - `npx svelte-kit sync` -> Kit writes generated config; watch for warnings
   - `npx svelte-check --tsconfig ./tsconfig.json --output human` -> error count + buckets
   - `npm run build` -> THE REAL GATE (exit 0 + `build/` produced + no `adapter_missing`)
   - `npm run test:unit` -> vitest suite
4. After each item: commit with prefix `KIT3(item-n):`. One item = one commit = revertible.
5. Update this file (Status table / checkboxes) as the LAST action of the item, before committing.

## Verified baseline (measured 2026-10-31 at a6fe9a9)

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
- [ ] 4. **Delete the fake page store**: `src/app/server/entry.ts` is a hand-rolled `readable()` page
  store; `src/app.d.ts:3` imports its `Page` type. Replace with Kit's own types and update
  `test/setup.ts:22` (`vi.mock("$app/stores")` -> `$app/state`).
- [ ] 5. **tsc's 83 non-CFM errors**: mostly `test/lib/api.test.ts` TS2345 `unknown` ->
  `Schema<unknown, unknown, never>` (zod 4 + `src/lib/api.ts`) and missing `vi`/`vitest` globals in
  `test/**`. Buckets need a proper categorize pass.
- [ ] 6. **vitest config**: `vitest.config.ts` calls `sveltekit()` with NO Kit options and aliases
  `$app` -> `.svelte-kit/runtime/app` (a Kit 2 path Kit 3 no longer emits).
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
- `npm run build` exits 0 today but produces no `build/` -> `npm start` / Vercel deploy are broken.
- Commit `a6fe9a9` added ONLY `ENV_EDITOR_FINDINGS.md`; its own message states the Kit options had
  not been migrated yet.
- Scratch capture files to ignore: `c5.txt`, `c6.txt`, `build.out`, `scripts/_tsprobe.cjs`, `sync.out`.
- Kit 3.1.0 peers: `typescript ^6.0.0` and `@opentelemetry/api` are `optional: true` in
  peerDependenciesMeta, so remaining on typescript 5.9.2 is fine (svelte-check 4.3.1 peer `>=5.0.0`).
  Required peers: `vite ^8.0.12` (8.3.5 ✓), `svelte ^5.57.1` (5.57.2 ✓),
  `@sveltejs/vite-plugin-svelte ^7.0.0` (6.2.4 installed - still to upgrade). vitest 5.0.5 peer
  `vite ^6.4.0 || ^7.0.0 || ^8.0.0` ✓. Kit also depends on `@rolldown/pluginutils ^1.0.1`
  (vite 8.3.5 is rolldown-based; vite-plugin-svelte prints an "experimental vite 8" warning).
- `src/env.ts` validators MAY be plain functions - `EnvVarConfig.schema` is
  `StandardSchemaV1<string|undefined,T> | ((value: string|undefined) => T|undefined)` and Kit wraps
  plain functions via `normalize_env_schema` (`src/exports/env/index.js`). No zod needed.

- `$lib` strategy = HYBRID: keep `alias: { $lib: './src/lib', $data: './src/data' }` in `sveltekit()`
  (Kit's own sanctioned escape hatch) to reach green, then do the `#lib` codemod as item 8.
  `alias` is deprecated in Kit 3.1 (`src/core/config/options.js:56`), so it is temporary.
- Treat the `tsconfig_invalid` "paths was overwritten" warning as likely NOISE until proven otherwise:
  `node_modules/$app/tsconfig.json` does contain correct `$lib`/`$data` paths and `$lib` typechecks, so
  Kit 3.1 is comparing backslash-absolute expected paths vs TS forward-slash resolved paths
  (`write_tsconfig/validate.js:75-96`). Confirm before "fixing" it.

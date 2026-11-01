# Findings: "Edit post" link gone after package updates (ENABLE_CONTENT_EDITOR)

Branch: `sveltekit-migration-3x`.
Status: **FIX APPLIED at `410fcb8` (2026-10-31)** - this file is the historical investigation, and the
live state is tracked in `MIGRATION_KIT3_CHECKLIST.md`. Sections A/B and the gate chain below describe the
PRE-FIX tree; do not treat them as current.

## Resolution actually shipped (commit `410fcb8`)

- The gate is now `import { ENABLE_CONTENT_EDITOR } from "$app/env/private";` in
  `src/lib/editing/core/auth.server.ts`, with `ENABLE_CONTENT_EDITOR` declared in `src/env.ts` using a
  plain-function validator (Kit 3 has no `env` object - each declared var is its own named export).
- `src/lib/s3.ts` was migrated the same way and kept its `AWS_X ?? VITE_X` fallbacks by re-declaring the
  4 legacy `VITE_AWS_*` names in `src/env.ts`.
- Always run `npx svelte-kit sync` after editing `src/env.ts`, or `node_modules/$app/types/env.d.ts`
  goes stale and you get `TS2724: has no exported member`.
- Verified end-to-end on `vite preview`: `/poems/edit/nonexistent-zzz` -> **403** with
  `ENABLE_CONTENT_EDITOR=false` and **404** with `=true` (the guard passes, unknown pid 404s).
- Section A (deleted `svelte.config.js`) is resolved: adapter-vercel, `sveltePreprocess` and the
  `$lib`/`$data` aliases live inside `sveltekit()` in `vite.config.js`. Section B is resolved by the
  `src/env.ts` schema. ~~`src/app/server/entry.ts` still exists~~ is now DELETED (checklist item 4,
  commit `fc50b42`), as is the invalid `Page` import it forced `src/app.d.ts` to carry.

## Symptom

The `Edit post` / editor links do not render locally, and editor routes 403, even though
`.env` and `.env.local` both contain `ENABLE_CONTENT_EDITOR=true`.

## The gate chain (verified, with line refs)

1. `src/lib/editing/core/auth.server.ts` (pre-fix) — `import { env } from "$env/dynamic/private";`
   then `env.ENABLE_CONTENT_EDITOR?.trim() === "true"`. (Now: a named export from `$app/env/private`.)
2. `src/routes/**/+page.server.ts` — passes `editorEnabled: isEditorEnabled()` into load data.
3. `src/routes/**/+page.svelte` — `data.editorEnabled ? ...editHref : null` (e.g.
   `src/routes/poems/[...pid]/+page.svelte:12-15`).
4. `src/lib/Article/index.svelte` — renders `actionHref`.

So: `env.ENABLE_CONTENT_EDITOR` is `undefined` -> `isEditorEnabled()` is false -> no link.

## Confirmed local env

- `.env` line 5 and `.env.local` line 5 both: `ENABLE_CONTENT_EDITOR=true` (plus AWS_* vars).
  These files are gitignored (`.gitignore:6-7`) — local only, as intended.

## Root cause (SvelteKit 3 env rewrite + a deleted config file)

Two independent migration breakages, both real:

### A. `svelte.config.js` is deleted in the working tree

`git status` shows `D  svelte.config.js` (staged deletion). The HEAD version that was deleted:

```js
import adapter from "@sveltejs/adapter-vercel";
import { sveltePreprocess } from "svelte-preprocess";

const config = {
  extensions: [".svelte", ".md"],
  preprocess: sveltePreprocess(),
  kit: { adapter: adapter(), alias: { $lib: "./src/lib", $data: "./src/data" } },
};
export default config;
```

Consequences of it being gone (at the time of writing - SINCE RESOLVED): no `adapter-vercel`, no `.md`
extension support, no `sveltePreprocess`. `vite.config.js` only re-added the `$lib`/`$data` aliases.
(Also untracked-new: `src/app/server/entry.ts` — likely the previous agent's
workaround for a missing config/hooks setup. It was later a fake page store and is now deleted,
checklist item 4.)

### B. Kit 3 env modules are now SCHEMA-DRIVEN, and the repo has no `src/env.ts`

Kit 3 (installed `@sveltejs/kit`) rewrote `$env` handling:
- `node_modules/@sveltejs/kit/src/exports/vite/plugins/env-vars.js:38-58` — generates
  `.svelte-kit/generated/{dev,build}/env/*` modules **derived from `src/env.ts`**
  (`resolve_env_entry` + `sync.env` + `create_env_modules`).
- `node_modules/@sveltejs/kit/src/core/env.js` — `create_env_modules`, `resolve_env_entry`.
- Types come from `@sveltejs/kit/env` (`EnvVarConfig`).

`src/env.ts` / `src/env.js` **do not exist** (`Test-Path` = false; `src/` has only
`app.css`, `app.d.ts`, `app.html`). Therefore the generated config is empty:

`.svelte-kit/generated/dev/env/config.js`:
```js
const variables = {};
export const dynamic_private_env = {};   // <- nothing exposed, so ENABLE_CONTENT_EDITOR is undefined
set_env({});
```

### C. `$env/dynamic/private` is deprecated but still functional

`node_modules/@sveltejs/kit/src/runtime/env/dynamic/private.js` re-exports
`$app/env/private` and warns `env_module_deprecated` in DEV. So the import itself is not
the failure — the empty schema is. New canonical import: `$app/env/private`.

## Unicorn chart (the env pipeline, broken path marked)

```
        .env / .env.local                src/env.ts (SCHEMA)              .svelte-kit/generated/**
      ENABLE_CONTENT_EDITOR=true   ->   EnvVarConfig{ private }     ->   env/config.js variables
                  \                              x MISSING                          |
                   \                        (Kit 3 requires this)                   v
                    `--- vite loadEnv() ---> set_env(process.env) ---> $app/env/private --> env.ENABLE_CONTENT_EDITOR
                                                    x                                     |
                                              empty {} <---------------------------------'
                                                                                          v
                                                              isEditorEnabled() -> false -> no "Edit post" link
```

### D. CORRECTION: Kit 3 does NOT load `svelte.config.js` — config moved into `vite.config.js`

Verified in installed Kit 3.1.0: `node_modules/@sveltejs/kit/src/exports/vite/index.js`
(~line 277) throws `config_file_unsupported` if a `svelte.config.js` is present, and the
docstring at ~line 163-164 says config "lived in a `svelte.config.js` file, which is no
longer supported". The previous agent's deletion was therefore **correct** — do NOT restore
it. The deleted config's jobs must instead be passed as options to `sveltekit({...})` in
`vite.config.js` (adapter, extensions, preprocess, kit.alias). `extract_svelte_config()`
exists in `src/core/config/index.js` for that purpose.

## Fix plan (IMPLEMENTED - historical record; do not re-do)

All four steps below landed (Kit 3 env rewrite, commit `410fcb8`): adapter-vercel 7.0.2,
`sveltePreprocess` and the `$lib`/`$data` aliases are inside `sveltekit({...})` in `vite.config.js`,
adapter-auto 8.0.0 is present for auto-selection on Vercel, `src/env.ts` declares the full private
schema, `$app/env/private` imports are in place, and the re-verify gates pass (`npm run check`,
`npm run test:unit` = 42 files / 409 tests). Numbered items are kept verbatim as history.

1. ~~Restore `svelte.config.js` from HEAD~~ -> instead move adapter-vercel, `.md`
   extension, `sveltePreprocess`, and `$lib`/`$data` aliases into `sveltekit({...})`
   options in `vite.config.js` (Kit 3 errors if `svelte.config.js` exists). Check whether
   `@sveltejs/adapter-vercel` is still installed before wiring it up.
2. Add `src/env.ts` declaring the private schema: `ENABLE_CONTENT_EDITOR`, `AWS_ACCESS_KEY_ID`,
   `AWS_ACCESS_SECRET`, `AWS_BUCKET`, `AWS_REGION` (optional/required per README rules).
3. Switch imports `$env/dynamic/private` -> `$app/env/private` in `auth.server.ts` and `src/lib/s3.ts`.
4. Re-verify: `npm run dev` (link returns), `npm run check`, `npm run test:unit`.

## Gotchas

- ~~`vitest.config.ts` aliases `$app` -> `./.svelte-kit/runtime/app` (a Kit 2 path). Kit 3
  generates under `.svelte-kit/generated/...`; that alias may need updating for tests.~~ RESOLVED
  (checklist item 6, commit `6baa13c`): the alias was DELETED, not updated. Kit 3 emits no
  `.svelte-kit/runtime/app` at all, `node_modules/$app` holds only `tsconfig/` + `types/`, and Kit
  declares every `$app/*` specifier as an ambient module (`@sveltejs/kit/src/exports/vite/
  write_app_types.js:281`), so no hand-written alias is needed. `npm run test:unit` stays green.
- `.env` is gitignored; CI/prod must set these vars in Vercel env instead. Never enable
  `ENABLE_CONTENT_EDITOR` in production (README "Local content editor" section, ~README:58).
- `src/lib/s3.ts:8-11` reads AWS vars from the same dynamic private env — same schema need.

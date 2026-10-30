# Findings: "Edit post" link gone after package updates (ENABLE_CONTENT_EDITOR)

Branch: `sveltekit-migration-3x` (HEAD `eb60c75` "MIGRATION: SvelteKit 3.x major migration started").
Status: investigation complete, fix not yet applied. Last updated 2026-10-29.

## Symptom

The `Edit post` / editor links do not render locally, and editor routes 403, even though
`.env` and `.env.local` both contain `ENABLE_CONTENT_EDITOR=true`.

## The gate chain (verified, with line refs)

1. `src/lib/editing/core/auth.server.ts:1,6` — `import { env } from "$env/dynamic/private";`
   then `env.ENABLE_CONTENT_EDITOR?.trim() === "true"`.
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

Consequences of it being gone: no `adapter-vercel`, no `.md` extension support, no
`sveltePreprocess`. `vite.config.js` only re-added the `$lib`/`$data` aliases.
(Also untracked-new: `src/app/server/entry.ts` — likely the previous agent's
workaround for a missing config/hooks setup.)

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

## Fix plan (to implement)

1. ~~Restore `svelte.config.js` from HEAD~~ -> instead move adapter-vercel, `.md`
   extension, `sveltePreprocess`, and `$lib`/`$data` aliases into `sveltekit({...})`
   options in `vite.config.js` (Kit 3 errors if `svelte.config.js` exists). Check whether
   `@sveltejs/adapter-vercel` is still installed before wiring it up.
2. Add `src/env.ts` declaring the private schema: `ENABLE_CONTENT_EDITOR`, `AWS_ACCESS_KEY_ID`,
   `AWS_ACCESS_SECRET`, `AWS_BUCKET`, `AWS_REGION` (optional/required per README rules).
3. Switch imports `$env/dynamic/private` -> `$app/env/private` in `auth.server.ts` and `src/lib/s3.ts`.
4. Re-verify: `npm run dev` (link returns), `npm run check`, `npm run test:unit`.

## Gotchas

- `vitest.config.ts` aliases `$app` -> `./.svelte-kit/runtime/app` (a Kit 2 path). Kit 3
  generates under `.svelte-kit/generated/...`; that alias may need updating for tests.
- `.env` is gitignored; CI/prod must set these vars in Vercel env instead. Never enable
  `ENABLE_CONTENT_EDITOR` in production (README:48).
- `src/lib/s3.ts:8-11` reads AWS vars from the same dynamic private env — same schema need.

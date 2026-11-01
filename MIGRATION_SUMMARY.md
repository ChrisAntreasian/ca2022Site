# SvelteKit 3.x Migration Summary

## Status: ON TRACK - Kit 3 works; `MIGRATION_KIT3_CHECKLIST.md` is the live tracker

Rewritten 2026-10-31 (branch `sveltekit-migration-3x`), covering commits `410fcb8` -> `6baa13c`.
Everything labelled OBSOLETE below was Kit-2-era panic that turned out to be WRONG - it is kept only as
history:

- "Layout refactor required / 50+ hours" was false. `Header.svelte`, `Footer.svelte`, `+error.svelte`
  and `EditorShell.svelte` already use Kit 3's `$app/state`, and the layouts build and render fine.
- "App won't build without further work" was false: `vite build` compiles, and `vite dev` / `vite preview`
  serve real SSR pages. The only build failure is a Windows privilege issue (adapter-vercel 7 route
  symlinks need Developer Mode), and Vercel CI runs on Linux so deploys are unaffected.
- "Downgrade back to Kit 2" is no longer an option worth considering.
- ~~`src/app/server/entry.ts` (hand-rolled `readable()` page store)~~ was listed as a success. It was the
  opposite - a fake store, and it is now DELETED (checklist item 4, commit `fc50b42`) together with the
  invalid `Page` import / `Readable<Page|null>` export it made `src/app.d.ts` carry.

### What Was Done Successfully ✅
- Removed `svelte.config.js` (no longer supported in SvelteKit 3.x)
- Created `vite.config.js` with proper SvelteKit plugin integration  
- Updated `src/app.d.ts` for TypeScript type support
- Modified `analytics.ts` to use `import.meta.env.SSR` instead of `$app/environment`
- Identified all files using `$page` and attempted migration

### OBSOLETE (pre-fix inventory - kept as history) ### Breaking Changes Discovered ❌
1. **`$app/stores` completely removed** - No longer exists in SvelteKit 3.x
2. **Global `page` store removed** - Cannot be accessed globally via import
3. **Custom readable store approach fails** - Page data must come from server context

### Files Modified
- ❌ `src/app/server/entry.ts` - was created with a `page` export (never worked for SSR; DELETED in
  checklist item 4)
- ✅ `vite.config.js` - Updated for SvelteKit 3.x compatibility  
- ❌ `svelte.config.js` - Removed (required by SvelteKit 3.x)

### OBSOLETE - disproven: "Layout Refactoring Required" 🔴

In SvelteKit 3.x, layout components (`Header`, `Footer`) **cannot access** page information like `$page.url.pathname` without either:
1. Passing data as props from parent component (major refactor needed)
2. Using URL parameters or localStorage for client-side routing
3. Keeping the app on SvelteKit 2.x pattern

### OBSOLETE - do not follow: Recommended Options

#### Option A: Keep Current Patterns (Recommended for MVP)
- Revert to use `import { page } from "$app/stores"` 
- This will work if you downgrade back to SvelteKit 2.x
- App maintains current functionality without major refactoring

#### Option B: Major Layout Refactor
- Remove all layout components from global `$page` usage
- Pass page data via props from parent `layout.svelte`  
- Or extract page info into URL params/local storage
- Estimated effort: 50+ hours of careful refactoring

#### Option C: Server-Side Prop Pattern (Advanced)
- Use server-side context in route handlers
- Extract data to pass down as props or slots
- Only works for server-rendered pages, not client navigation

### OBSOLETE - already overtaken: Decision Required

**How would you like to proceed?**

1. **Revert SvelteKit 3.x changes** and stay on SvelteKit 2.x (safest option)
2. **Keep current state as-is** - app won't build without further work  
3. **Proceed with layout refactoring** - requires substantial manual effort
4. **Use URL params/local storage workaround** for page info

### Technical Notes

The core issue is that SvelteKit 3.x architecture fundamentally changed:
- Removed auto-reexported stores (`$app/stores`)
- No longer provides global page context  
- Requires explicit data passing or different architectural patterns

This is similar to how React 18+ removed some legacy APIs - it's a deliberate breaking change for cleaner architecture.

## Where the migration actually stands (measured at `6baa13c`)

Done: Kit options moved into `sveltekit()` in `vite.config.js` and `svelte.config.js` deleted (Kit 3
throws `config_file_unsupported`); root `tsconfig.json` extends `$app/tsconfig` instead of the empty
`.svelte-kit/tsconfig.json` stub; env rewrite complete (`src/env.ts` declares every var, code imports
named exports from `$app/env/private` - `$env/dynamic/private` and the `env` object no longer exist);
adapter-vercel 7.0.2 + adapter-auto 8.0.0 + vite-plugin-svelte 7.3.1; dead `svelte-kit package` script
deleted and `start` re-pointed to `vite preview`; **item 4** deleted the fake page store
`src/app/server/entry.ts` and reduced `src/app.d.ts` to Kit's canonical
`/// <reference types="@sveltejs/kit" />` + `export {}` shell while `test/setup.ts` mocks
`$app/state` instead of the removed `$app/stores`; **item 6** removed the dead `$app` alias from
`vitest.config.ts`; **item 8 part 1** deleted the zero-reference root junk `index.ts` and
`test-mkkey.js`.

Measured gates: `tsc` 83 errors and `svelte-check` 94 errors / 0 warnings (both with 0 `Cannot find
module`, down from ~250 / 302 total diagnostics; 94 has now held steady across items 4, 6 and 8, which
proved those three items caused zero regressions); `npm run test:unit` = 42 test files / 409 tests passed
in ~9.3-10.3 s; dev + preview return 200 for `/` and `/poems` and 404 for a bogus route; `ENABLE_CONTENT_EDITOR`
returns 403 when false and 404 for a real page when true; `vite build` compiles 349 server + 897 client
modules (`built in 699 ms`) before the Windows symlink EPERM. The `esbuild`/`keepNames` question is settled and proven to be a
no-op for this app - see the notes section of the checklist; do NOT add that knob.

### Item 8 part 2a: the `#lib` / `#data` codemod (DONE 2026-10-31)

`package.json` now declares Node subpath imports - `"imports": { "#lib/*": "./src/lib/*",`
`"#data/*": "./src/data/*" }` - every `$lib/...` / `$data/...` import across `src/**` and `test/**` was
rewritten to `#lib/...` / `#data/...` (92 files, 291 insertions / 291 deletions, pure 1:1 import swaps),
and the deprecated `alias` option was deleted from `sveltekit()` in `vite.config.js` and from
`resolve.alias` in `vitest.config.ts`. Kit therefore now prints **ZERO warnings** - both
`config_option_deprecated_alias` and `tsconfig_invalid` are gone.

THE HARD-WON FACT: Vite, Vitest and Node read package.json `imports` natively; **this repo's TypeScript
5.9.2 does not**, because it inherits `paths: {}` from `node_modules/$app/tsconfig.json`. When the aliases
were removed without adding `paths`, `tsc` + `svelte-check` reported **149 `TS2307 Cannot find module
'#lib/...'`** (svelte-check 243 errors / 86 files) - the aliases had been propping up TypeScript the whole
migration. `npx tsc --showConfig` proved the extends chain was intact (`moduleResolution: bundler`,
`resolvePackageJsonImports: true`, `paths: {}`) yet `#lib/*` was still unresolvable. The fix is
`paths: {"#lib/*": ["./src/lib/*"], "#data/*": ["./src/data/*"]}` in the root `tsconfig.json`, no
`baseUrl` (adding one breaks the inherited Kit config). After that every count is back at baseline:
svelte-check 94 / 15 files, tsc 83, CFM 0, vitest 42 files / 409 tests, `built in 699 ms`.

Open next (see the checklist): **item 5** - the remaining 94 svelte-check / 83 tsc diagnostics, already
bucketed from `--output machine`: **20** × `Property 'toBeInTheDocument' does not exist on type
'Assertion<...>'` (jest-dom matchers untyped), **12** × `Argument of type 'unknown' is not assignable to
parameter of type 'Schema<unknown, unknown, never>'` (`test/lib/api.test.ts` + zod 4), **~40** ×
`Property 'x' does not exist on type 'void | (Omit<PageData, ...> ...)'` (the `*-page.server.test.ts`
route tests), **7** × `GallaryProps` prop mismatch, **1** × `slots:` not allowed in Svelte 5 `render()`,
4 × `Error & { status; body }` arg mismatches and odds; then **item 7** (Developer Mode / admin for the
local `npm run build` symlink EPERM), then the **lint gates** - `eslint .` currently reports **5,626
errors that are ALL inside gitignored artifacts** (`.vercel/output/**`, `coverage/`, `docs/_audit.cjs`)
because ESLint 9 flat config does not read `.eslintignore`, so `eslint.config.js` needs an
`ignores: [...]` entry; and prettier still flags `README.md`, the migration docs, `src/env.ts` and
`scripts/check-mojibake.mjs`. Item 8 part 2b (vitest peer unpin; `npm run test:unit:coverage` =
75.63% statements / 49.03% branches / 74.87% functions / 75.46% lines) is DONE as well. Always run
`npx svelte-kit sync` after editing `src/env.ts`.

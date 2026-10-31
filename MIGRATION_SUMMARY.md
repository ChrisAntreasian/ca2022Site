# SvelteKit 3.x Migration Summary

## Status: ON TRACK - Kit 3 works; `MIGRATION_KIT3_CHECKLIST.md` is the live tracker

Rewritten 2026-10-31 at commit `410fcb8` (branch `sveltekit-migration-3x`). Everything labelled
OBSOLETE below was Kit-2-era panic that turned out to be WRONG - it is kept only as history:

- "Layout refactor required / 50+ hours" was false. `Header.svelte`, `Footer.svelte`, `+error.svelte`
  and `EditorShell.svelte` already use Kit 3's `$app/state`, and the layouts build and render fine.
- "App won't build without further work" was false: `vite build` compiles, and `vite dev` / `vite preview`
  serve real SSR pages. The only build failure is a Windows privilege issue (adapter-vercel 7 route
  symlinks need Developer Mode), and Vercel CI runs on Linux so deploys are unaffected.
- "Downgrade back to Kit 2" is no longer an option worth considering.
- `src/app/server/entry.ts` (hand-rolled `readable()` page store) was listed as a success. It is the
  opposite: it is a fake store to DELETE (checklist item 4) because `src/app.d.ts:3` imports its `Page` type.

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
- ✅ `src/app/server/entry.ts` - Created with page export (doesn't work for SSR)
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

## Where the migration actually stands (measured at `410fcb8`)

Done: Kit options moved into `sveltekit()` in `vite.config.js` and `svelte.config.js` deleted (Kit 3
throws `config_file_unsupported`); root `tsconfig.json` extends `$app/tsconfig` instead of the empty
`.svelte-kit/tsconfig.json` stub; env rewrite complete (`src/env.ts` declares every var, code imports
named exports from `$app/env/private` - `$env/dynamic/private` and the `env` object no longer exist);
adapter-vercel 7.0.2 + adapter-auto 8.0.0 + vite-plugin-svelte 7.3.1; dead `svelte-kit package` script
deleted and `start` re-pointed to `vite preview`.

Measured gates: `tsc` 83 errors and `svelte-check` 94 (both with 0 `Cannot find module`, down from ~250 /
302 total diagnostics); dev + preview return 200 for `/` and `/poems`; `ENABLE_CONTENT_EDITOR` returns
403 when false and 404 for a real page when true.

Open next (see the checklist): item 4 delete `src/app/server/entry.ts` + fix `src/app.d.ts` /
`test/setup.ts`, item 5 the remaining diagnostics, item 6 `vitest.config.ts` (still passes no Kit options
and aliases `$app` to a Kit 2 path), item 8 the `#lib`/`#data` codemod. Local `npm run build` needs
Windows Developer Mode or an elevated shell. Always run `npx svelte-kit sync` after editing `src/env.ts`.

/// <reference types="@sveltejs/kit" />

// Kit 3 declares the base `App` namespace itself (see
// node_modules/@sveltejs/kit/types/index.d.ts:3966-3996), and this project does not yet augment
// `Locals`, `PageData`, `PageState` or `Platform`, so there is nothing to declare here yet.
//
// The previous version of this file imported `Page` from `./app/server/entry.js` and re-exported a
// `Readable<Page | null>` page store. That file was a hand-rolled Kit 2 workaround that never even
// exported a `Page` type (only a `readable()` const), and Kit 3 replaced stores with the state
// object: components already use `import { page } from "$app/state"`
// (Header, Footer, +error.svelte, EditorShell.svelte). Removing this export does not affect them.

export {};

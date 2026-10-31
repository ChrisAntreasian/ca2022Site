# Christopher Antreasians Personal Site

Built this silly thing with blood, tears, and too many open tabs.

## Why Svelte?

After years of React, I wanted to learn something different and build this site in a lighter way.

Also, all React and no Svelte makes Jack a dull boy.

## Site intent

This site is for sharing my art, writing, and work history without living entirely inside social platforms.

A second goal is keeping operating costs low. Runtime content is served from versioned JSON in this repo, and deployments happen through CI/CD.

## Content model and workflow

Content lives in [src/data](src/data).

- Current content files are in [src/data](src/data).
- Historical snapshots are in [src/data/history](src/data/history).

Normal update flow:

1. Edit content locally (JSON or local editor routes).
2. Verify locally.
3. Commit and push.
4. Deploy via CI/CD.

## Local development

Common commands:

- npm run dev
- npm run check
- npm run test:unit
- npm run build
- npm run preview

Install note: `npm install` needs `--legacy-peer-deps`, because SvelteKit 3 declares an optional
`typescript ^6.0.0` peer while the eslint toolchain pins `>=4.8.4 <6.1.0` against typescript 5.9.2.

Windows build note: `npm run build` runs `@sveltejs/adapter-vercel`, which symlinks every route into
`.vercel/output/functions`. Without Windows Developer Mode (or an elevated shell) it stops with
`EPERM: symlink ... index.func`; `npm run preview` still works because `vite preview` serves
`.svelte-kit/output` directly. Vercel's CI builds on Linux, so deploys are unaffected.

## Local content editor

Editor access is controlled by ENABLE_CONTENT_EDITOR, which is declared in `src/env.ts` and read in
server code as `import { ENABLE_CONTENT_EDITOR } from "$app/env/private"`. If you change `src/env.ts`,
run `npx svelte-kit sync` (or `npm run check`, which runs it first) so the generated env types update.

- ENABLE_CONTENT_EDITOR=true: editor routes are enabled.
- Any other value (or missing): editor routes return 403.

Important: this is intended for local/internal editing. Do not enable it in public production unless you explicitly want runtime editing exposed.

Current editor routes:

- Poems new: /poems/edit/new
- Poems existing: /poems/edit/{id} or /poems/edit/{id}/{slug}
- Terms of service page: /terms-of-service
- Terms of service editor: /terms-of-service/edit
- Web experience intro: /web-experience/edit/intro
- Web experience new: /web-experience/edit/new
- Web experience existing: /web-experience/edit/{id} or /web-experience/edit/{id}/{slug}
- Quintuplapus existing: /the-quintuplapus/edit/{id} or /the-quintuplapus/edit/{id}/{slug}
- Souljuicer existing: /the-souljuicer/edit/{id}

## Safety checks before commit

Run these before shipping content changes:

- npm run check
- npm run test:unit
- npm run check:encoding

Optional deep encoding audit (includes history snapshots):

- npm run check:encoding:all

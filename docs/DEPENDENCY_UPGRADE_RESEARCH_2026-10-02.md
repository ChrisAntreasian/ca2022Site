# Dependency Upgrade Research and Plan (2026-10-02)

## Scope

- Repository: `ca2022Site`
- Working branch created from base branch: `chore/dependency-upgrade-plan-2026-10` (from `origin/master`)
- Goal: investigate outdated packages, risk, and a safe update plan before making dependency changes.

## What I ran

- `npm outdated --long`
- `npm audit --omit=dev`
- `npm audit fix --dry-run --json`
- `npm run check`
- `npm run test:unit`
- `npm view ...` checks for engines and peer dependencies on key major-version candidates

## Baseline health before any upgrades

- Type/Svelte checks: pass with 0 errors, 1 warning (unused selector in `src/routes/terms-of-service/+page.svelte`).
- Unit tests: pass (`42` files, `409` tests).

## Findings summary

### 1) Version drift

Most packages are behind, but many can be moved forward within the current major (low-to-medium risk).

Notable outdated direct dependencies/devDependencies:

- Framework/tooling core:
  - `@sveltejs/kit` `2.42.2 -> 2.70.3` (latest major is `3.0.0`)
  - `svelte` `5.39.4 -> 5.57.1`
  - `vite` `7.1.6 -> 7.3.6` (latest major `8.3.2`)
  - `vitest` `3.2.4 -> 3.2.7` (latest major `5.0.3`)
- Lint/format:
  - `eslint` `9.36.0 -> 9.39.5` (major `10` available)
  - `@eslint/js` `9.36.0 -> 9.39.5` (major `10` available)
  - `typescript-eslint` packages `8.44.0 -> 8.71.0`
  - `prettier` `3.6.2 -> 3.9.9`
- Runtime packages:
  - `effect` `3.17.14 -> 3.22.2` (major `4` available)
  - `qs` `6.14.0 -> 6.16.0`
  - `mixpanel-browser` `2.70.0 -> 2.83.0`
  - `aws-sdk` `2.1692.0 -> 2.1693.0`

### 2) Security pressure (important)

From `npm audit --omit=dev`:

- `14` vulnerabilities (`8` high, `5` moderate, `1` low).
- Important direct package implications:
  - `@sveltejs/kit` has multiple advisories affecting current range.
  - `effect <3.20.0` has a high-severity issue; current is vulnerable.
  - `qs <=6.15.3` is vulnerable; current is vulnerable.
  - `vite 7.0.0 - 7.3.3` contains multiple advisories; current is vulnerable.
  - `svelte <=5.55.6` contains SSR/XSS advisories; current is vulnerable.

From `npm audit fix --dry-run --json` (prod+dev graph):

- `32` vulnerabilities total (`5` critical, `16` high, `10` moderate, `1` low).
- Includes a critical Vitest advisory on versions `<3.2.6` (current `3.2.4`), which is solved by moving to `3.2.7`.

### 3) Major-version compatibility research

Key compatibility constraints from package metadata:

- `@sveltejs/kit@3.0.0`:
  - requires Node `>=22.17`
  - peers: `vite ^8.0.12`, `svelte ^5.57.1`, `typescript ^6.0.0`, `@sveltejs/vite-plugin-svelte ^7`
- `@sveltejs/kit@2.70.3` (target within major):
  - works with `vite ^5/^6/^7/^8`, `svelte ^4/^5`, `typescript ^5.3.3 || ^6`
- `@sveltejs/vite-plugin-svelte@7`:
  - peers: `vite ^8`, `svelte ^5.46.4`
- `vitest@5.0.3`:
  - engine: Node `^22.12 || ^24 || >=26`
  - peers include aligned `@vitest/*` packages at `5.0.3`
- `eslint@10`:
  - engine: Node `^20.19 || ^22.13 || >=24`
- `typescript` dist-tags currently show:
  - `latest: 7.0.2`, `rc: 7.0.1-rc`, `beta: 6.0.0-beta`

Interpretation:

- There is a safe, high-value path staying on current majors first.
- Jumping to SvelteKit 3 requires a coordinated stack move (Kit 3 + Vite 8 + plugin 7 + TypeScript 6/7), increasing break risk.

### 4) Runtime impact hot spots in this repo

- `effect` is used in server/business logic (`src/lib/api.ts`, `src/lib/build.ts`, multiple `+page.server.ts` files).
- `qs` is used in API query building (`src/lib/api.ts`, several build routes).
- `aws-sdk` is used in `src/lib/s3.ts` only (currently v2 API style).
- `mixpanel-browser` is loaded dynamically in `src/lib/analytics.ts` client-side.

## Recommended plan (phased)

## Phase 1: Security and patch/minor stabilization (do this first)

Objective: reduce vulnerabilities quickly with minimal migration risk.

Update to `wanted` (or current-major latest where equivalent):

- `@sveltejs/kit` -> `2.70.3`
- `svelte` -> `5.57.1`
- `vite` -> `7.3.6`
- `vitest`, `@vitest/ui`, `@vitest/coverage-v8` -> `3.2.7`
- `@playwright/test` -> `1.63.0`
- `effect` -> `3.22.2`
- `qs` -> `6.16.0`
- `mixpanel-browser` -> `2.83.0`
- `svelte-check` -> `4.7.6`
- `@sveltejs/adapter-vercel` -> `5.10.3`
- `@sveltejs/vite-plugin-svelte` -> `6.2.4`
- Lint/format minor line:
  - `eslint` + `@eslint/js` -> `9.39.5`
  - `typescript-eslint` family -> `8.71.0`
  - `prettier` -> `3.9.9`
  - `prettier-plugin-svelte` -> `3.5.2`

Validation gate for Phase 1:

- `npm run check`
- `npm run test:unit`
- `npm test` (Playwright)
- `npm audit --omit=dev`

Expected outcome: major vulnerability reduction without cross-major migrations.

## Phase 2: Evaluate selective majors with contained blast radius

Candidates:

- `eslint 10`
- `globals 17`
- `jsdom 29` / `happy-dom 20`
- `prettier-plugin-svelte 4`
- `vitest 5` (only after Phase 1 is stable)

Approach:

- Upgrade one ecosystem cluster at a time.
- Run full validation suite after each cluster.
- Keep each cluster in separate commit(s) for clean rollback.

## Phase 3: Strategic migration decision

### Option A: Stay on Kit 2 line for now

- Continue patch/minor maintenance, maximize stability.
- Reassess Kit 3 when TypeScript and plugin ecosystem are settled for this codebase.

### Option B: Migrate to Kit 3 stack

Requires coordinated upgrades:

- `@sveltejs/kit 3`
- `vite 8`
- `@sveltejs/vite-plugin-svelte 7`
- `svelte >=5.57.1`
- `typescript >=6`
- likely adapter major updates (`@sveltejs/adapter-vercel 7`)

This should be treated as a dedicated migration epic, not a routine dependency bump.

## Specific caveats

- `aws-sdk` advisory output recommends `npm audit fix --force`, but that path proposes `aws-sdk@1.18.0` and is not an acceptable automatic fix. Keep `aws-sdk@2` patched and plan a manual migration to AWS SDK v3 separately.
- TypeScript `latest` currently points at major `7`. Do not auto-jump this repo to TS 7 during routine updates.

## Proposed execution sequence (when ready to implement)

1. Apply Phase 1 updates in a single upgrade PR (or 2 PRs: framework/test + lint/format).
2. Validate with check/unit/e2e/audit.
3. If green, proceed with Phase 2 cluster-by-cluster.
4. Open a separate planning issue for Kit 3 migration feasibility and scope.

## Decision request

If this plan looks good, next step is to execute Phase 1 upgrades on this branch and report exact before/after audit + test deltas.

## Phase 1 execution results (completed)

### Branch

- Executed on: `chore/dependency-upgrade-plan-2026-10` (off `origin/master`)

### What was upgraded

- Framework/test toolchain:
  - `@sveltejs/kit` `2.42.2 -> 2.70.3`
  - `svelte` `5.39.4 -> 5.57.1`
  - `vite` `7.1.6 -> 7.3.6`
  - `vitest` `3.2.4 -> 3.2.7`
  - `@vitest/ui` `3.2.4 -> 3.2.7`
  - `@vitest/coverage-v8` `3.2.4 -> 3.2.7`
  - `@playwright/test` `1.55.0 -> 1.63.0`
  - `@sveltejs/adapter-auto` `6.1.0 -> 6.1.1`
  - `@sveltejs/adapter-vercel` `5.10.2 -> 5.10.3`
  - `@sveltejs/vite-plugin-svelte` `6.2.0 -> 6.2.4`
  - `svelte-check` `4.3.1 -> 4.7.6`
- Runtime packages:
  - `effect` `3.17.14 -> 3.22.2`
  - `qs` `6.14.0 -> 6.16.0`
  - `mixpanel-browser` `2.70.0 -> 2.83.0`
  - `aws-sdk` `2.1692.0 -> 2.1693.0`
  - `@fontsource/fira-mono` `5.2.7 -> 5.3.0`
- Lint/format/types:
  - `eslint` `9.36.0 -> 9.39.5`
  - `@eslint/js` `9.36.0 -> 9.39.5`
  - `@typescript-eslint/eslint-plugin` `8.44.0 -> 8.71.0`
  - `@typescript-eslint/parser` `8.44.0 -> 8.71.0`
  - `typescript-eslint` `8.44.0 -> 8.71.0`
  - `prettier` `3.6.2 -> 3.9.9`
  - `prettier-plugin-svelte` `3.4.0 -> 3.5.2`
  - `typescript` `5.9.2 -> 5.9.3`
  - `@types/node` `22.18.6 -> 22.20.5`
  - `@types/qs` `6.14.0 -> 6.15.1`

### Additional compatibility change made

- Updated npm scripts to remove deprecated Prettier option:
  - `lint`: removed `--plugin-search-dir=.`
  - `format`: removed `--plugin-search-dir=.`

### Validation outcomes

- `npm run test:unit`: pass (`42` files, `409` tests).
- `npm run lint`: runs, but fails due existing repo-wide formatting drift (Prettier check reports many files).
- `npm run check`: now surfaces numerous pre-existing/latent strict type issues in tests and some route/component typing, likely exposed by newer tooling/type definitions.

### Security delta

- Before Phase 1 (`npm audit --omit=dev`): `14` vulnerabilities (`8` high, `5` moderate, `1` low).
- After Phase 1 (`npm audit --omit=dev`): `10` vulnerabilities (`4` high, `3` moderate, `3` low).

Remaining high-impact items are largely transitive and/or require major migration paths (e.g., Kit 3 stack move, AWS SDK v3 migration) rather than safe in-place minor updates.

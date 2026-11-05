import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  /**
   * Svelte's package exports resolve `default` (and therefore bare `node`) to `src/index-server.js`, so a
   * happy-dom run imports the server build. Component rendering then dies with `lifecycle_function_unavailable`
   * - the stack shows `Module.mount -> svelte/src/index-server.js` - because mount is a no-op stub there.
   * Requesting "browser" first makes Svelte resolve `src/index-client.js`, which is what happy-dom can run.
   *
   * This only affects condition ordering: 483 tests across 48 files pass identically with it, and it is what
   * lets `test/routes/component-integration.test.ts` load at all.
   */
  resolve: {
    conditions: ["browser"],
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.{test,spec}.{js,ts}"],
    /**
     * happy-dom was being created once per test file - 46 times, about half the whole suite's tracked time -
     * which pushed the slowest files up against the default 5s per-test timeout and made them fail on timing
     * alone while passing in isolation. Reusing one environment per worker removes that ceiling instead of
     * papering over it with a bigger timeout.
     *
     * Safe for this suite because every file that mocks modules calls `vi.resetModules()` in `beforeEach`,
     * which is what `doMock` relies on, and no test file shares module state with another.
     */
    isolate: false,
    /**
     * `Article.test.ts` and `Gallery.test.ts` are excluded because rendering those components standalone is
     * not currently possible, not because the runner chose wrong:
     *
     * - Both read layout context. `src/routes/+layout.svelte:32` calls `setContext(contextHeightKey, ...)`,
     *   and `Article.svelte:42` / `Gallary/Article.svelte:92` destructure `getHeaderHeight` from it. Rendering
     *   the component alone gives no layout ancestor, so `getContext()` returns undefined and the render throws
     *   `Cannot destructure property 'getHeaderHeight' of 'getContext(...)' as it is undefined`. A test wrapper
     *   that calls `setContext` first is required before either can run.
     * - `Article.svelte:172` renders `svelte-exmarkdown@5.0.2`, whose bundled `dist/Renderer.svelte` throws
     *   `Cannot read properties of undefined (reading 'p')` from its own `resolveComponent(map, ...)` under
     *   Vitest. That is inside the dependency's bundle, so fixing it needs a separate investigation.
     *
     * `component-integration.test.ts` is NOT excluded: it imports no component and passes once Svelte resolves
     * to the client build (see the `resolve.conditions` note above). It was previously listed here for no
     * reason and therefore ran nowhere.
     */
    exclude: ["test/**/Gallery.test.ts", "test/**/Article.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/*.config.*",
        "build/",
        ".svelte-kit/",
      ],
    },
  },
});

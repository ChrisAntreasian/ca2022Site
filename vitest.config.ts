import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
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
     * which is what `doMock` relies on; the three component/integration files are already excluded above.
     */
    isolate: false,
    exclude: [
      "test/**/Gallery.test.ts",
      "test/**/Article.test.ts",
      "test/**/*component*.{test,spec}.{js,ts}",
    ],
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

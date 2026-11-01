import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.{test,spec}.{js,ts}"],
    exclude: [
      "test/**/Gallery.test.ts",
      "test/**/Article.test.ts",
      "test/**/*component*.{test,spec}.{js,ts}",
    ], // Exclude component tests that require browser environment
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
  // No `resolve.alias` here any more: `#lib` / `#data` are Node subpath imports declared in
  // package.json, and Vite, Vitest and TypeScript all resolve them natively
  // (https://svelte.dev/e/kit/config_option_deprecated_alias). Kit's plugin still rewrites the
  // generated `./$types` specifiers at build time, which is why `sveltekit()` stays in `plugins`.
});

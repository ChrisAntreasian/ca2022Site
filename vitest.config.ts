import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";
import path from "path";

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
  resolve: {
    // Kit 3 no longer emits `.svelte-kit/runtime/app` (that was a Kit 2 generated path), so the old
    // `$app` alias pointed at a directory that does not exist. Kit's own Vite plugin handles every
    // `$app/*` specifier at runtime; `node_modules/$app` contains only tsconfig + types. Removing the
    // alias is safe for tests as long as `npm run test:unit` stays green (verified).
    alias: {
      $lib: path.resolve(__dirname, "./src/lib"),
      $data: path.resolve(__dirname, "./src/data"),
    },
  },
});

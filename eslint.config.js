import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeAndBrowser = { ...globals.browser, ...globals.node };

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // Global ignores - the contents of the deleted `.eslintignore`, which
    // ESLint 9 no longer reads. Without these, `eslint .` lints Kit's
    // generated output and every build/test artifact on disk.
    ignores: [
      ".DS_Store",
      "node_modules",
      "build/",
      ".svelte-kit/",
      "package/",
      ".vercel/",
      ".output/",
      "coverage/",
      "test-results/",
      ".env",
      ".env.*",
      "!.env.example",
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
    ],
  },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: nodeAndBrowser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS tooling is not TS or ESM code: `require`/`module`/`__dirname`
    // are its normal shape, so `no-undef` and the TS `no-require-imports`
    // rule must not apply to it.
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

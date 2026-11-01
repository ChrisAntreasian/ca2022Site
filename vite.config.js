import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { sveltePreprocess } from "svelte-preprocess";

/**
 * Kit 3 has no svelte.config.js - every Kit option (adapter, preprocess, ...) is passed to the
 * sveltekit() plugin call in this file.
 *
 * There is deliberately no `alias` option any more. Kit 3.1 deprecates `config.alias`
 * (config_option_deprecated_alias) and no longer feeds it into the TypeScript config it generates at
 * node_modules/$app/tsconfig.json, whose `paths` map is empty - so keeping the aliases would have
 * meant Vite resolved `$lib`/$data while TypeScript could not typecheck them.
 *
 * `$lib` and `$data` are instead replaced by Node subpath imports declared in package.json
 * ("#lib/*": "./src/lib/*", "#data/*": "./src/data/*"), which Vite, TypeScript, Vitest and Node all
 * resolve natively: https://svelte.dev/e/kit/config_option_deprecated_alias
 *
 * @type {import('vite').UserConfig}
 */
const config = {
  plugins: [
    sveltekit({
      adapter: adapter(),
      preprocess: sveltePreprocess(),
    }),
  ],
};

export default config;

import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { sveltePreprocess } from "svelte-preprocess";

/**
 * Kit 3 has no svelte.config.js - every Kit option (adapter, preprocess, alias, ...)
 * must be passed to the sveltekit() plugin call. Vite's own `resolve.alias` is NOT used
 * by Kit for either bundling or the generated TypeScript paths (node_modules/$app/tsconfig.json),
 * which is why putting $lib/$data there left Kit's generated config empty.
 *
 * `alias` is deprecated in Kit 3.1 (subpath imports like `#lib` are the new default) but is
 * still the supported escape hatch for keeping existing $lib/$data specifiers working.
 *
 * @type {import('vite').UserConfig}
 */
const config = {
  plugins: [
    sveltekit({
      adapter: adapter(),
      preprocess: sveltePreprocess(),
      alias: {
        $lib: "./src/lib",
        $data: "./src/data",
      },
    }),
  ],
};

export default config;

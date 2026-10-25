import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { sveltePreprocess } from "svelte-preprocess";

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    sveltekit({
      adapter: adapter(),
      alias: {
        $lib: "./src/lib",
      },
      extensions: [".svelte", ".md"],
      preprocess: sveltePreprocess(),
    }),
  ],
};

export default config;

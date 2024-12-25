import adapter from '@sveltejs/adapter-vercel';
import { sveltePreprocess } from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".md"],
  preprocess: sveltePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $lib: "./src/lib",
      $data: "./src/data",
    },
  },
};

export default config;

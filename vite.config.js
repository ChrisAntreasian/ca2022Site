import { sveltekit } from "@sveltejs/kit/vite";
import path from "path";
import { sveltePreprocess } from "svelte-preprocess";

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
      $data: path.resolve("./src/data"),
    },
  },
};

export default config;

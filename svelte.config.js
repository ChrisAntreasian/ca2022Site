import adapterauto from "@sveltejs/adapter-auto";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".md"],
  preprocess: preprocess(),
  kit: {
    adapter: adapterauto(),
        alias: {
          $lib: "./src/lib",
          $data: "./src/data"
        }
      
  },
};

export default config;

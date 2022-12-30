
import adapterauto from "@sveltejs/adapter-auto";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".md"],
	preprocess: preprocess(),
  kit: {
    adapter: adapterauto(),
  },
};

export default config;


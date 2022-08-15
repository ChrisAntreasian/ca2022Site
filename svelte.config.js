import node from "@sveltejs/adapter-node";
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],
	preprocess: preprocess(),
  kit: {
    adapter: node({ envPrefix: { port: process.env.PORT } }),
  },
};

export default config;


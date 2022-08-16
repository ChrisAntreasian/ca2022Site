import node from "@sveltejs/adapter-node";
import preprocess from 'svelte-preprocess';
console.log( process.env.PORT)

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],
	preprocess: preprocess(),
  kit: {
    adapter: node(),
  },
};

export default config;


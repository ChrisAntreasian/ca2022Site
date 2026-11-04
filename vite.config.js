import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";

const config = {
  plugins: [
    sveltekit({
      adapter: adapter(),
    }),
  ],
};

export default config;

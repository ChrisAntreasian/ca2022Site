import { sveltekit } from '@sveltejs/kit/vite';
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		sveltekit(),	
	],
	resolve: {
		alias: {
			$data: path.resolve("./src/data")
		}
	}
};

export default config;

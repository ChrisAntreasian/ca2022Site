import { sveltekit } from '@sveltejs/kit/vite';
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
	build: {
		target:"es2022"
	},
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

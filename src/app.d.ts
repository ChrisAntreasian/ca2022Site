/// <reference types="@sveltejs/kit" />

declare namespace App {
	interface Locals {
		session: import('svelte-kit-cookie-session').Session<{distinctId: string}>;
	}
}
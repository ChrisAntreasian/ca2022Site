/// <reference types="@sveltejs/kit" />
import { Readable } from 'svelte/store';
import type { Page } from './app/server/entry.js';

declare namespace App {
}

export declare const page: Readable<Page | null>;

// src/app/server/entry.ts - SvelteKit 3.x page store export
import { readable } from 'svelte/store';

// Create a proper writable store that will be updated via hydration
export const page = readable(
  null as unknown, // Initial SSR value
  (set) => {
    // This will be populated by SvelteKit's server-side rendering during navigation
    set({ 
      url: new URL('http://localhost'),
      pathname: '/',
      searchParams: new URLSearchParams(),
      href: 'http://localhost/'
    });
    
    return () => {};
  }
);

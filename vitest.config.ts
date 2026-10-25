import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'test/**/Gallery.test.ts', 
      'test/**/Article.test.ts',
      'test/**/*component*.{test,spec}.{js,ts}',
      'test/**/*.e2e.spec.ts'
    ], // Exclude component tests that require browser environment
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        'build/',
        '.svelte-kit/'
      ]
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve(import.meta.dirname, './src/lib'),
      '$data': path.resolve(import.meta.dirname, './src/data'),
      '$app': path.resolve(import.meta.dirname, './.svelte-kit/runtime/app')
    }
  }
});
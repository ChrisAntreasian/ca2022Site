import { describe, it, expect } from 'vitest';

describe('History Utilities', () => {
  describe('cleanUrlSlug', () => {
    it('converts spaces to hyphens and lowercases', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('Hello! @#$% World?')).toBe('hello-world');
    });

    it('handles multiple consecutive spaces/special chars', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('Hello    !!!   World???')).toBe('hello-world');
    });

    it('removes leading hyphens', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('---Hello World')).toBe('hello-world');
    });

    it('removes trailing hyphens', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('Hello World---')).toBe('hello-world');
    });

    it('removes both leading and trailing hyphens', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('---Hello World---')).toBe('hello-world');
    });

    it('handles strings with only special characters', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('!@#$%^&*()')).toBe('');
    });

    it('preserves numbers and letters', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('Article 123 Test')).toBe('article-123-test');
    });

    it('handles already clean slugs', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('hello-world')).toBe('hello-world');
    });

    it('handles empty strings', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('')).toBe('');
    });

    it('handles single characters', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('a')).toBe('a');
      expect(cleanUrlSlug('!')).toBe('');
    });

    it('handles complex mixed cases', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('The Quick Brown Fox!!! Jumps Over??? The Lazy Dog.')).toBe('the-quick-brown-fox-jumps-over-the-lazy-dog');
    });

    it('handles multiple hyphens in middle', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('hello----world')).toBe('hello-world');
    });

    it('handles unicode characters', async () => {
      const { cleanUrlSlug } = await import('../../src/lib/history');
      expect(cleanUrlSlug('café résumé')).toBe('caf-r-sum');
    });
  });
});

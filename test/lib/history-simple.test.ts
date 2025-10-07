import { describe, it, expect } from 'vitest';
import { cleanUrlSlug } from '$lib/history';

describe('History Utilities', () => {
  describe('cleanUrlSlug', () => {
    it('converts spaces to hyphens and lowercases', () => {
      expect(cleanUrlSlug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(cleanUrlSlug('Hello! @#$% World?')).toBe('hello-world');
    });

    it('handles multiple consecutive spaces/special chars', () => {
      expect(cleanUrlSlug('Hello    !!!   World???')).toBe('hello-world');
    });

    it('removes leading hyphens', () => {
      expect(cleanUrlSlug('---Hello World')).toBe('hello-world');
    });

    it('removes trailing hyphens', () => {
      expect(cleanUrlSlug('Hello World---')).toBe('hello-world');
    });

    it('removes both leading and trailing hyphens', () => {
      expect(cleanUrlSlug('---Hello World---')).toBe('hello-world');
    });

    it('handles strings with only special characters', () => {
      expect(cleanUrlSlug('!@#$%^&*()')).toBe('');
    });

    it('preserves numbers and letters', () => {
      expect(cleanUrlSlug('Article 123 Test')).toBe('article-123-test');
    });

    it('handles already clean slugs', () => {
      expect(cleanUrlSlug('hello-world')).toBe('hello-world');
    });

    it('handles empty strings', () => {
      expect(cleanUrlSlug('')).toBe('');
    });

    it('handles single characters', () => {
      expect(cleanUrlSlug('a')).toBe('a');
      expect(cleanUrlSlug('!')).toBe('');
    });

    it('handles complex mixed cases', () => {
      expect(cleanUrlSlug('The Quick Brown Fox!!! Jumps Over??? The Lazy Dog.')).toBe('the-quick-brown-fox-jumps-over-the-lazy-dog');
    });

    it('handles multiple hyphens in middle', () => {
      expect(cleanUrlSlug('hello----world')).toBe('hello-world');
    });

    it('handles unicode characters', () => {
      expect(cleanUrlSlug('café résumé')).toBe('caf-r-sum');
    });
  });
});

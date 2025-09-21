import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanUrlSlug, clientNavigate } from '../../src/lib/history';

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
  pushState: vi.fn(),
}));

import { pushState } from '$app/navigation';

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

  describe('clientNavigate', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      
      // Mock window.scrollTo
      Object.defineProperty(window, 'scrollTo', {
        value: vi.fn(),
        writable: true,
      });
    });

    it('navigates to URL without slug when scroll is false', () => {
      const navigate = clientNavigate(false);
      navigate('/test-path');

      expect(pushState).toHaveBeenCalledWith('/test-path', {});
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('navigates to URL without slug when scroll is true', () => {
      const navigate = clientNavigate(true);
      navigate('/test-path');

      expect(pushState).toHaveBeenCalledWith('/test-path', {});
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it('navigates to URL with cleaned slug when scroll is false', () => {
      const navigate = clientNavigate(false);
      navigate('/test-path', 'Hello World!');

      expect(pushState).toHaveBeenCalledWith('/test-path/hello-world', {});
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('navigates to URL with cleaned slug when scroll is true', () => {
      const navigate = clientNavigate(true);
      navigate('/test-path', 'Hello World!');

      expect(pushState).toHaveBeenCalledWith('/test-path/hello-world', {});
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it('handles empty slug', () => {
      const navigate = clientNavigate(false);
      navigate('/test-path', '');

      expect(pushState).toHaveBeenCalledWith('/test-path/', {});
    });

    it('handles complex slugs', () => {
      const navigate = clientNavigate(false);
      navigate('/articles', 'The Quick Brown Fox!!! Jumps Over the Lazy Dog.');

      expect(pushState).toHaveBeenCalledWith('/articles/the-quick-brown-fox-jumps-over-the-lazy-dog', {});
    });

    it('handles root path navigation', () => {
      const navigate = clientNavigate(true);
      navigate('/', 'test-slug');

      expect(pushState).toHaveBeenCalledWith('/test-slug', {});
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it('preserves URL structure with multiple path segments', () => {
      const navigate = clientNavigate(false);
      navigate('/category/subcategory', 'article title');

      expect(pushState).toHaveBeenCalledWith('/category/subcategory/article-title', {});
    });

    it('handles special characters in URL path', () => {
      const navigate = clientNavigate(false);
      navigate('/path-with-hyphens', 'slug with spaces');

      expect(pushState).toHaveBeenCalledWith('/path-with-hyphens/slug-with-spaces', {});
    });

    it('creates different navigation functions based on scroll parameter', () => {
      const scrollNavigate = clientNavigate(true);
      const noScrollNavigate = clientNavigate(false);

      scrollNavigate('/path1');
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });

      vi.clearAllMocks();

      noScrollNavigate('/path2');
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });
});

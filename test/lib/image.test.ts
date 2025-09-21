import { describe, it, expect } from 'vitest';
import { safeImageString } from '../../src/lib/image';
import type { StrapiImageData } from '../../src/lib/typing/art';

describe('Image Utilities', () => {
  describe('safeImageString', () => {
    const createMockImageData = (hasFormat: boolean = true, size: string = 'medium'): StrapiImageData => ({
      data: {
        attributes: {
          url: '/default-image.jpg',
          formats: hasFormat ? {
            [size]: {
              url: `/image-${size}.jpg`,
              width: 800,
              height: 600,
            },
          } : {},
        },
      },
    });

    it('returns formatted image URL when format exists', () => {
      const imageData = createMockImageData(true, 'medium');
      const result = safeImageString('medium')(imageData);
      
      expect(result).toBe('/image-medium.jpg');
    });

    it('returns default URL when requested format does not exist', () => {
      const imageData = createMockImageData(false);
      const result = safeImageString('medium')(imageData);
      
      expect(result).toBe('/default-image.jpg');
    });

    it('works with small format', () => {
      const imageData = createMockImageData(true, 'small');
      const result = safeImageString('small')(imageData);
      
      expect(result).toBe('/image-small.jpg');
    });

    it('works with thumbnail format', () => {
      const imageData = createMockImageData(true, 'thumbnail');
      const result = safeImageString('thumbnail')(imageData);
      
      expect(result).toBe('/image-thumbnail.jpg');
    });

    it('works with original format', () => {
      const imageData = createMockImageData(true, 'original');
      const result = safeImageString('original')(imageData);
      
      expect(result).toBe('/image-original.jpg');
    });

    it('falls back to default URL for non-existent format', () => {
      const imageData: StrapiImageData = {
        data: {
          attributes: {
            url: '/fallback-image.jpg',
            formats: {
              large: {
                url: '/image-large.jpg',
                width: 1200,
                height: 900,
              },
            },
          },
        },
      };

      const result = safeImageString('medium')(imageData);
      
      expect(result).toBe('/fallback-image.jpg');
    });

    it('handles empty formats object', () => {
      const imageData: StrapiImageData = {
        data: {
          attributes: {
            url: '/default.jpg',
            formats: {},
          },
        },
      };

      const result = safeImageString('medium')(imageData);
      
      expect(result).toBe('/default.jpg');
    });

    it('works with complex image data structure', () => {
      const complexImageData: StrapiImageData = {
        data: {
          attributes: {
            url: '/original-high-res.jpg',
            formats: {
              small: {
                url: '/optimized-small.webp',
                width: 300,
                height: 200,
              },
              medium: {
                url: '/optimized-medium.webp',
                width: 600,
                height: 400,
              },
              thumbnail: {
                url: '/thumb.jpg',
                width: 150,
                height: 100,
              },
            },
          },
        },
      };

      expect(safeImageString('small')(complexImageData)).toBe('/optimized-small.webp');
      expect(safeImageString('medium')(complexImageData)).toBe('/optimized-medium.webp');
      expect(safeImageString('thumbnail')(complexImageData)).toBe('/thumb.jpg');
      expect(safeImageString('original')(complexImageData)).toBe('/original-high-res.jpg');
    });

    it('is a curried function that can be partially applied', () => {
      const getMediumImage = safeImageString('medium');
      const getThumbnailImage = safeImageString('thumbnail');

      const imageData = createMockImageData(true, 'medium');
      const imageDataWithThumb = createMockImageData(true, 'thumbnail');

      expect(typeof getMediumImage).toBe('function');
      expect(typeof getThumbnailImage).toBe('function');

      expect(getMediumImage(imageData)).toBe('/image-medium.jpg');
      expect(getThumbnailImage(imageDataWithThumb)).toBe('/image-thumbnail.jpg');
    });

    it('handles different URL patterns', () => {
      const imageWithAbsoluteUrl: StrapiImageData = {
        data: {
          attributes: {
            url: 'https://cdn.example.com/default.jpg',
            formats: {
              medium: {
                url: 'https://cdn.example.com/medium.jpg',
                width: 600,
                height: 400,
              },
            },
          },
        },
      };

      const result = safeImageString('medium')(imageWithAbsoluteUrl);
      expect(result).toBe('https://cdn.example.com/medium.jpg');

      const fallbackResult = safeImageString('original')(imageWithAbsoluteUrl);
      expect(fallbackResult).toBe('https://cdn.example.com/default.jpg');
    });

    it('maintains functional programming pattern with fp-ts', () => {
      // Test that the function composition works correctly
      const imageData = createMockImageData(true, 'small');
      
      // The function should work in a functional pipeline
      const processImage = (data: StrapiImageData) => 
        safeImageString('small')(data);

      expect(processImage(imageData)).toBe('/image-small.jpg');
    });
  });
});

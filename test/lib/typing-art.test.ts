import { describe, it, expect } from 'vitest';
import { either as E } from 'fp-ts';
import {
  imageC,
  strapiImageDataC,
  artBaseC,
  artC,
  artCategoryC,
  type StrapiImageData,
  type ArtWithId
} from '../../src/lib/typing/art';

describe('Art Type Validation', () => {
  describe('imageC codec', () => {
    it('validates base image structure', () => {
      const validBaseImage = {
        ext: '.jpg',
        height: 1080,
        hash: 'abc123hash',
        mime: 'image/jpeg',
        name: 'test-image.jpg',
        size: 204800,
        url: '/uploads/test-image.jpg',
        width: 1920,
        path: '/path/to/image'
      };

      const result = imageC.decode(validBaseImage);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Check if it's a base image (has width/height properties)
        if ('width' in result.right && 'height' in result.right) {
          expect(result.right.name).toBe('test-image.jpg');
          expect(result.right.width).toBe(1920);
          expect(result.right.height).toBe(1080);
        }
      }
    });

    it('validates image attributes structure', () => {
      const validImageAttrs = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        alternativeText: 'Alt text for image',
        caption: 'Image caption',
        provider: 'local',
        provider_metadata: { key: 'value' },
        previewUrl: '/uploads/preview.jpg',
        url: '/uploads/full-image.jpg',
        formats: {
          small: {
            ext: '.jpg',
            height: 400,
            hash: 'small_hash',
            mime: 'image/jpeg',
            name: 'small.jpg',
            size: 51200,
            url: '/uploads/small.jpg',
            width: 600,
            path: null
          },
          thumbnail: {
            ext: '.jpg',
            height: 100,
            hash: 'thumb_hash',
            mime: 'image/jpeg',
            name: 'thumb.jpg',
            size: 5120,
            url: '/uploads/thumb.jpg',
            width: 150,
            path: null
          }
        }
      };

      const result = imageC.decode(validImageAttrs);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Check if it's an image attributes object (has alternativeText)
        if ('alternativeText' in result.right) {
          expect(result.right.alternativeText).toBe('Alt text for image');
          if (result.right.formats && typeof result.right.formats === 'object' && 'small' in result.right.formats) {
            expect(result.right.formats.small.width).toBe(600);
          }
        }
      }
    });

    it('handles null path in base image', () => {
      const validImageWithNullPath = {
        ext: '.png',
        height: 800,
        hash: 'png_hash',
        mime: 'image/png',
        name: 'test.png',
        size: 102400,
        url: '/uploads/test.png',
        width: 1200,
        path: null
      };

      const result = imageC.decode(validImageWithNullPath);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Check if it's a base image (has path property)
        if ('path' in result.right) {
          expect(result.right.path).toBeNull();
        }
      }
    });

    it('handles null formats in image attributes', () => {
      const validImageWithNullFormats = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        alternativeText: 'Alt text',
        caption: 'Caption',
        provider: 'local',
        provider_metadata: null,
        previewUrl: null,
        url: '/uploads/image.jpg',
        formats: null
      };

      const result = imageC.decode(validImageWithNullFormats);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Check if it's an image attributes object (has formats and previewUrl)
        if ('formats' in result.right && 'previewUrl' in result.right) {
          expect(result.right.formats).toBeNull();
          expect(result.right.previewUrl).toBeNull();
        }
      }
    });

    it('rejects invalid image structure', () => {
      const invalidImage = {
        ext: '.jpg',
        height: 'not-a-number',
        hash: 'abc123hash',
        mime: 'image/jpeg',
        name: 'test.jpg',
        size: 204800,
        url: '/uploads/test.jpg',
        width: 1920,
        path: null
      };

      const result = imageC.decode(invalidImage);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('strapiImageDataC codec', () => {
    it('validates image data wrapper with valid content', () => {
      const validImageData = {
        data: {
          id: 1,
          attributes: {
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T15:30:00.000Z',
            alternativeText: 'Test image',
            caption: 'Test caption',
            provider: 'local',
            provider_metadata: {},
            previewUrl: null,
            url: '/uploads/test.jpg',
            formats: null
          }
        }
      };

      const result = strapiImageDataC.decode(validImageData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const typed: StrapiImageData = result.right;
        expect(typed.data).not.toBeNull();
        if (typed.data) {
          expect(typed.data.id).toBe(1);
          expect(typed.data.attributes.alternativeText).toBe('Test image');
        }
      }
    });

    it('validates null image data', () => {
      const nullImageData = {
        data: null
      };

      const result = strapiImageDataC.decode(nullImageData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).toBeNull();
      }
    });
  });

  describe('artBaseC codec', () => {
    it('validates complete art base structure', () => {
      const validArtBase = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        description: 'A beautiful piece of art',
        order: 1,
        image: {
          data: {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              alternativeText: 'Art image',
              caption: 'Art caption',
              provider: 'local',
              provider_metadata: null,
              previewUrl: null,
              url: '/uploads/art.jpg',
              formats: null
            }
          }
        }
      };

      const result = artBaseC.decode(validArtBase);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.description).toBe('A beautiful piece of art');
        expect(result.right.order).toBe(1);
        expect(result.right.image.data).not.toBeNull();
      }
    });

    it('validates art base with null image', () => {
      const validArtWithNullImage = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        description: 'Art without image',
        order: 2,
        image: {
          data: null
        }
      };

      const result = artBaseC.decode(validArtWithNullImage);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.image.data).toBeNull();
      }
    });

    it('rejects invalid order type', () => {
      const invalidArt = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        description: 'Valid description',
        order: 'not-a-number',
        image: {
          data: null
        }
      };

      const result = artBaseC.decode(invalidArt);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('artC codec', () => {
    it('validates complete art structure', () => {
      const validArt = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        description: 'A masterpiece',
        order: 1,
        image: {
          data: null
        },
        title: 'Untitled #1',
        createdDate: '2023-01-15',
        medium: 'Oil on canvas'
      };

      const result = artC.decode(validArt);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.title).toBe('Untitled #1');
        expect(result.right.createdDate).toBe('2023-01-15');
        expect(result.right.medium).toBe('Oil on canvas');
      }
    });

    it('rejects missing art-specific fields', () => {
      const invalidArt = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        description: 'Valid description',
        order: 1,
        image: {
          data: null
        },
        title: 'Untitled #1'
        // missing createdDate and medium
      };

      const result = artC.decode(invalidArt);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('artCategoryC codec', () => {
    it('validates complete art category structure', () => {
      const validCategory = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        title: 'Paintings',
        art_pieces: {
          data: [
            {
              id: 1,
              attributes: {
                createdAt: '2023-12-01T10:00:00.000Z',
                updatedAt: '2023-12-01T15:30:00.000Z',
                publishedAt: '2023-12-01T16:00:00.000Z',
                description: 'First painting',
                order: 1,
                image: { data: null },
                title: 'Painting 1',
                createdDate: '2023-01-01',
                medium: 'Watercolor'
              }
            }
          ]
        },
        omit: undefined
      };

      const result = artCategoryC.decode(validCategory);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.title).toBe('Paintings');
        expect(result.right.art_pieces?.data).toHaveLength(1);
      }
    });

    it('validates category with undefined art pieces', () => {
      const validCategoryNoArt = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        title: 'Empty Category',
        art_pieces: undefined,
        omit: undefined
      };

      const result = artCategoryC.decode(validCategoryNoArt);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.title).toBe('Empty Category');
        expect(result.right.art_pieces).toBeUndefined();
      }
    });

    it('validates category with omit field', () => {
      const validCategoryWithOmit = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        title: 'Category with Omissions',
        art_pieces: undefined,
        omit: {
          data: [
            { id: 1, attributes: null },
            { id: 2, attributes: null }
          ]
        }
      };

      const result = artCategoryC.decode(validCategoryWithOmit);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.omit?.data).toHaveLength(2);
      }
    });

    it('rejects invalid category structure', () => {
      const invalidCategory = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z',
        title: 123, // should be string
        art_pieces: undefined
      };

      const result = artCategoryC.decode(invalidCategory);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('Type aliases and exports', () => {
    it('uses ArtWithId type correctly', () => {
      const artWithId: ArtWithId = {
        id: 1,
        attributes: {
          createdAt: '2023-12-01T10:00:00.000Z',
          updatedAt: '2023-12-01T15:30:00.000Z',
          publishedAt: '2023-12-01T16:00:00.000Z',
          description: 'Test art',
          order: 1,
          image: { data: null },
          title: 'Test Title',
          createdDate: '2023-01-01',
          medium: 'Digital'
        }
      };

      // This should compile without issues
      expect(artWithId.id).toBe(1);
      expect(artWithId.attributes.title).toBe('Test Title');
    });

    it('uses StrapiImageData type correctly', () => {
      const imageData: StrapiImageData = {
        data: {
          id: 1,
          attributes: {
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T15:30:00.000Z',
            alternativeText: 'Test',
            caption: 'Test',
            provider: 'local',
            provider_metadata: null,
            previewUrl: null,
            url: '/test.jpg',
            formats: null
          }
        }
      };

      // This should compile without issues
      expect(imageData.data).not.toBeNull();
      if (imageData.data) {
        expect(imageData.data.id).toBe(1);
      }
    });
  });

  describe('Complex validation scenarios', () => {
    it('validates nested image formats structure', () => {
      const complexImageData = {
        data: {
          id: 1,
          attributes: {
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T15:30:00.000Z',
            alternativeText: 'Complex image',
            caption: 'With multiple formats',
            provider: 'cloudinary',
            provider_metadata: { public_id: 'test_id' },
            previewUrl: '/preview.jpg',
            url: '/full.jpg',
            formats: {
              small: {
                ext: '.jpg',
                height: 400,
                hash: 'small_hash',
                mime: 'image/jpeg',
                name: 'small.jpg',
                size: 25600,
                url: '/small.jpg',
                width: 600,
                path: null
              },
              medium: {
                ext: '.jpg',
                height: 800,
                hash: 'medium_hash',
                mime: 'image/jpeg',
                name: 'medium.jpg',
                size: 102400,
                url: '/medium.jpg',
                width: 1200,
                path: null
              },
              thumbnail: {
                ext: '.jpg',
                height: 100,
                hash: 'thumb_hash',
                mime: 'image/jpeg',
                name: 'thumb.jpg',
                size: 5120,
                url: '/thumb.jpg',
                width: 150,
                path: null
              }
            }
          }
        }
      };

      const result = strapiImageDataC.decode(complexImageData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.data) {
        const formats = result.right.data.attributes.formats;
        if (formats && typeof formats === 'object' && 'small' in formats) {
          expect(formats.small.width).toBe(600);
          expect(formats.medium?.width).toBe(1200);
          expect(formats.thumbnail.width).toBe(150);
        }
      }
    });
  });
});

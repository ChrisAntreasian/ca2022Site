import { describe, it, expect } from "vitest";
import { Result, Schema } from "effect";
import {
  imageC,
  strapiImageDataC,
  artBaseC,
  artC,
  artCategoryC,
  type StrapiImageData,
  type ArtWithId,
} from "../../src/lib/typing/art";

describe("Art Type Validation", () => {
  describe("imageC codec", () => {
    it("validates base image structure", () => {
      const validBaseImage = {
        ext: ".jpg",
        height: 1080,
        hash: "abc123hash",
        mime: "image/jpeg",
        name: "test-image.jpg",
        size: 204800,
        url: "/uploads/test-image.jpg",
        width: 1920,
        path: "/path/to/image",
      };

      const result = Schema.decodeUnknownResult(imageC)(validBaseImage);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        // Check if it's a base image (has width/height properties)
        if ("width" in result.success && "height" in result.success) {
          expect(result.success.name).toBe("test-image.jpg");
          expect(result.success.width).toBe(1920);
          expect(result.success.height).toBe(1080);
        }
      }
    });

    it("validates image attributes structure", () => {
      const validImageAttrs = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        alternativeText: "Alt text for image",
        caption: "Image caption",
        provider: "local",
        provider_metadata: { key: "value" },
        previewUrl: "/uploads/preview.jpg",
        url: "/uploads/full-image.jpg",
        formats: {
          small: {
            ext: ".jpg",
            height: 400,
            hash: "small_hash",
            mime: "image/jpeg",
            name: "small.jpg",
            size: 51200,
            url: "/uploads/small.jpg",
            width: 600,
            path: null,
          },
          thumbnail: {
            ext: ".jpg",
            height: 100,
            hash: "thumb_hash",
            mime: "image/jpeg",
            name: "thumb.jpg",
            size: 5120,
            url: "/uploads/thumb.jpg",
            width: 150,
            path: null,
          },
        },
      };

      const result = Schema.decodeUnknownResult(imageC)(validImageAttrs);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        // Check if it's an image attributes object (has alternativeText)
        if ("alternativeText" in result.success) {
          expect(result.success.alternativeText).toBe("Alt text for image");
          if (
            result.success.formats &&
            typeof result.success.formats === "object" &&
            "small" in result.success.formats
          ) {
            expect(result.success.formats.small.width).toBe(600);
          }
        }
      }
    });

    it("handles null path in base image", () => {
      const validImageWithNullPath = {
        ext: ".png",
        height: 800,
        hash: "png_hash",
        mime: "image/png",
        name: "test.png",
        size: 102400,
        url: "/uploads/test.png",
        width: 1200,
        path: null,
      };

      const result = Schema.decodeUnknownResult(imageC)(validImageWithNullPath);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        // Check if it's a base image (has path property)
        if ("path" in result.success) {
          expect(result.success.path).toBeNull();
        }
      }
    });

    it("handles null formats in image attributes", () => {
      const validImageWithNullFormats = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        alternativeText: "Alt text",
        caption: "Caption",
        provider: "local",
        provider_metadata: null,
        previewUrl: null,
        url: "/uploads/image.jpg",
        formats: null,
      };

      const result = Schema.decodeUnknownResult(imageC)(
        validImageWithNullFormats,
      );

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        // Check if it's an image attributes object (has formats and previewUrl)
        if ("formats" in result.success && "previewUrl" in result.success) {
          expect(result.success.formats).toBeNull();
          expect(result.success.previewUrl).toBeNull();
        }
      }
    });

    it("rejects invalid image structure", () => {
      const invalidImage = {
        ext: ".jpg",
        height: "not-a-number",
        hash: "abc123hash",
        mime: "image/jpeg",
        name: "test.jpg",
        size: 204800,
        url: "/uploads/test.jpg",
        width: 1920,
        path: null,
      };

      const result = Schema.decodeUnknownResult(imageC)(invalidImage);
      expect(Result.isFailure(result)).toBe(true);
    });
  });

  describe("strapiImageDataC codec", () => {
    it("validates image data wrapper with valid content", () => {
      const validImageData = {
        data: {
          id: 1,
          attributes: {
            createdAt: "2023-12-01T10:00:00.000Z",
            updatedAt: "2023-12-01T15:30:00.000Z",
            alternativeText: "Test image",
            caption: "Test caption",
            provider: "local",
            provider_metadata: {},
            previewUrl: null,
            url: "/uploads/test.jpg",
            formats: null,
          },
        },
      };

      const result =
        Schema.decodeUnknownResult(strapiImageDataC)(validImageData);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const typed: StrapiImageData = result.success;
        expect(typed.data).not.toBeNull();
        if (typed.data) {
          expect(typed.data.id).toBe(1);
          expect(typed.data.attributes.alternativeText).toBe("Test image");
        }
      }
    });

    it("validates null image data", () => {
      const nullImageData = {
        data: null,
      };

      const result =
        Schema.decodeUnknownResult(strapiImageDataC)(nullImageData);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.data).toBeNull();
      }
    });
  });

  describe("artBaseC codec", () => {
    it("validates complete art base structure", () => {
      const validArtBase = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        description: "A beautiful piece of art",
        order: 1,
        image: {
          data: {
            id: 1,
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              alternativeText: "Art image",
              caption: "Art caption",
              provider: "local",
              provider_metadata: null,
              previewUrl: null,
              url: "/uploads/art.jpg",
              formats: null,
            },
          },
        },
      };

      const result = Schema.decodeUnknownResult(artBaseC)(validArtBase);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.description).toBe("A beautiful piece of art");
        expect(result.success.order).toBe(1);
        expect(result.success.image.data).not.toBeNull();
      }
    });

    it("validates art base with null image", () => {
      const validArtWithNullImage = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        description: "Art without image",
        order: 2,
        image: {
          data: null,
        },
      };

      const result = Schema.decodeUnknownResult(artBaseC)(
        validArtWithNullImage,
      );

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.image.data).toBeNull();
      }
    });

    it("rejects invalid order type", () => {
      const invalidArt = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        description: "Valid description",
        order: "not-a-number",
        image: {
          data: null,
        },
      };

      const result = Schema.decodeUnknownResult(artBaseC)(invalidArt);
      expect(Result.isFailure(result)).toBe(true);
    });
  });

  describe("artC codec", () => {
    it("validates complete art structure", () => {
      const validArt = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        description: "A masterpiece",
        order: 1,
        image: {
          data: null,
        },
        title: "Untitled #1",
        createdDate: "2023-01-15",
        medium: "Oil on canvas",
      };

      const result = Schema.decodeUnknownResult(artC)(validArt);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.title).toBe("Untitled #1");
        expect(result.success.createdDate).toBe("2023-01-15");
        expect(result.success.medium).toBe("Oil on canvas");
      }
    });

    it("rejects missing art-specific fields", () => {
      const invalidArt = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        description: "Valid description",
        order: 1,
        image: {
          data: null,
        },
        title: "Untitled #1",
        // missing createdDate and medium
      };

      const result = Schema.decodeUnknownResult(artC)(invalidArt);
      expect(Result.isFailure(result)).toBe(true);
    });
  });

  describe("artCategoryC codec", () => {
    it("validates complete art category structure", () => {
      const validCategory = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Paintings",
        art_pieces: {
          data: [
            {
              id: 1,
              attributes: {
                createdAt: "2023-12-01T10:00:00.000Z",
                updatedAt: "2023-12-01T15:30:00.000Z",
                publishedAt: "2023-12-01T16:00:00.000Z",
                description: "First painting",
                order: 1,
                image: { data: null },
                title: "Painting 1",
                createdDate: "2023-01-01",
                medium: "Watercolor",
              },
            },
          ],
        },
        omit: undefined,
      };

      const result = Schema.decodeUnknownResult(artCategoryC)(validCategory);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.title).toBe("Paintings");
        expect(result.success.art_pieces?.data).toHaveLength(1);
      }
    });

    it("validates category with undefined art pieces", () => {
      const validCategoryNoArt = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Empty Category",
        art_pieces: undefined,
        omit: undefined,
      };

      const result =
        Schema.decodeUnknownResult(artCategoryC)(validCategoryNoArt);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.title).toBe("Empty Category");
        expect(result.success.art_pieces).toBeUndefined();
      }
    });

    it("validates category with omit field", () => {
      const validCategoryWithOmit = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Category with Omissions",
        art_pieces: undefined,
        omit: {
          data: [
            { id: 1, attributes: null },
            { id: 2, attributes: null },
          ],
        },
      };

      const result = Schema.decodeUnknownResult(artCategoryC)(
        validCategoryWithOmit,
      );

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.omit?.data).toHaveLength(2);
      }
    });

    it("rejects invalid category structure", () => {
      const invalidCategory = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: 123, // should be string
        art_pieces: undefined,
      };

      const result = Schema.decodeUnknownResult(artCategoryC)(invalidCategory);
      expect(Result.isFailure(result)).toBe(true);
    });
  });

  describe("Type aliases and exports", () => {
    it("uses ArtWithId type correctly", () => {
      const artWithId: ArtWithId = {
        id: 1,
        attributes: {
          createdAt: "2023-12-01T10:00:00.000Z",
          updatedAt: "2023-12-01T15:30:00.000Z",
          publishedAt: "2023-12-01T16:00:00.000Z",
          description: "Test art",
          order: 1,
          image: { data: null },
          title: "Test Title",
          createdDate: "2023-01-01",
          medium: "Digital",
        },
      };

      // This should compile without issues
      expect(artWithId.id).toBe(1);
      expect(artWithId.attributes.title).toBe("Test Title");
    });

    it("uses StrapiImageData type correctly", () => {
      const imageData: StrapiImageData = {
        data: {
          id: 1,
          attributes: {
            createdAt: "2023-12-01T10:00:00.000Z",
            updatedAt: "2023-12-01T15:30:00.000Z",
            alternativeText: "Test",
            caption: "Test",
            provider: "local",
            provider_metadata: null,
            previewUrl: null,
            url: "/test.jpg",
            formats: null,
          },
        },
      };

      // This should compile without issues
      expect(imageData.data).not.toBeNull();
      if (imageData.data) {
        expect(imageData.data.id).toBe(1);
      }
    });
  });

  describe("Complex validation scenarios", () => {
    it("validates nested image formats structure", () => {
      const complexImageData = {
        data: {
          id: 1,
          attributes: {
            createdAt: "2023-12-01T10:00:00.000Z",
            updatedAt: "2023-12-01T15:30:00.000Z",
            alternativeText: "Complex image",
            caption: "With multiple formats",
            provider: "cloudinary",
            provider_metadata: { public_id: "test_id" },
            previewUrl: "/preview.jpg",
            url: "/full.jpg",
            formats: {
              small: {
                ext: ".jpg",
                height: 400,
                hash: "small_hash",
                mime: "image/jpeg",
                name: "small.jpg",
                size: 25600,
                url: "/small.jpg",
                width: 600,
                path: null,
              },
              medium: {
                ext: ".jpg",
                height: 800,
                hash: "medium_hash",
                mime: "image/jpeg",
                name: "medium.jpg",
                size: 102400,
                url: "/medium.jpg",
                width: 1200,
                path: null,
              },
              thumbnail: {
                ext: ".jpg",
                height: 100,
                hash: "thumb_hash",
                mime: "image/jpeg",
                name: "thumb.jpg",
                size: 5120,
                url: "/thumb.jpg",
                width: 150,
                path: null,
              },
            },
          },
        },
      };

      const result =
        Schema.decodeUnknownResult(strapiImageDataC)(complexImageData);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result) && result.success.data) {
        const formats = result.success.data.attributes.formats;
        if (formats && typeof formats === "object" && "small" in formats) {
          expect(formats.small.width).toBe(600);
          expect(formats.medium?.width).toBe(1200);
          expect(formats.thumbnail.width).toBe(150);
        }
      }
    });
  });
});

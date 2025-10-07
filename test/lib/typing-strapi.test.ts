import { describe, it, expect } from 'vitest';
import { Schema, Either } from 'effect';
import {
  strapiMetaDataC,
  withIdC,
  strapiDataC,
  strapiDataArrC,
  strapiUpdatedC,
  strapiBaseC
} from '../../src/lib/typing/strapi';

describe('Strapi Type Validation', () => {
  describe('strapiMetaDataC codec', () => {
    it('validates correct metadata structure', () => {
      const validData = {
        meta: {
          pagination: {
            page: 1,
            pageCount: 10,
            pageSize: 25,
            total: 250
          }
        }
      };

      const result = Schema.decodeUnknownEither(strapiMetaDataC)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual(validData);
      }
    });

    it('rejects invalid metadata structure', () => {
      const invalidData = {
        meta: {
          pagination: {
            page: 'not-a-number',
            pageCount: 10,
            pageSize: 25,
            total: 250
          }
        }
      };

      const result = Schema.decodeUnknownEither(strapiMetaDataC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });

    it('rejects missing pagination fields', () => {
      const invalidData = {
        meta: {
          pagination: {
            page: 1,
            pageCount: 10
            // missing pageSize and total
          }
        }
      };

      const result = Schema.decodeUnknownEither(strapiMetaDataC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });

    it('rejects null values in required fields', () => {
      const invalidData = {
        meta: {
          pagination: {
            page: 1,
            pageCount: null,
            pageSize: 25,
            total: 250
          }
        }
      };

      const result = Schema.decodeUnknownEither(strapiMetaDataC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('withIdC codec factory', () => {
    it('creates codec that validates object with id and attributes', () => {
      const testCodec = Schema.Struct({
        name: Schema.String,
        active: Schema.Boolean
      });

      const wrappedCodec = withIdC(testCodec);

      const validData = {
        id: 123,
        attributes: {
          name: 'Test Item',
          active: true
        }
      };

      const result = Schema.decodeUnknownEither(wrappedCodec)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id).toBe(123);
        expect(result.right.attributes.name).toBe('Test Item');
      }
    });

    it('rejects invalid id type', () => {
      const testCodec = Schema.Struct({
        name: Schema.String
      });

      const wrappedCodec = withIdC(testCodec);

      const invalidData = {
        id: 'not-a-number',
        attributes: {
          name: 'Test Item'
        }
      };

      const result = Schema.decodeUnknownEither(wrappedCodec)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });

    it('rejects invalid attributes structure', () => {
      const testCodec = Schema.Struct({
        name: Schema.String,
        count: Schema.Number
      });

      const wrappedCodec = withIdC(testCodec);

      const invalidData = {
        id: 123,
        attributes: {
          name: 'Test Item',
          count: 'not-a-number'
        }
      };

      const result = Schema.decodeUnknownEither(wrappedCodec)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('strapiDataC codec factory', () => {
    it('validates single data wrapper with valid content', () => {
      const testCodec = Schema.Struct({
        title: Schema.String
      });

      const dataCodec = strapiDataC(testCodec);

      const validData = {
        data: {
          id: 1,
          attributes: {
            title: 'Test Title'
          }
        }
      };

      const result = Schema.decodeUnknownEither(dataCodec)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.data).not.toBeNull();
        if (result.right.data) {
          expect(result.right.data.id).toBe(1);
          expect(result.right.data.attributes.title).toBe('Test Title');
        }
      }
    });

    it('validates data wrapper with null content', () => {
      const testCodec = Schema.Struct({
        title: Schema.String
      });

      const dataCodec = strapiDataC(testCodec);

      const validData = {
        data: null
      };

      const result = Schema.decodeUnknownEither(dataCodec)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.data).toBeNull();
      }
    });

    it('rejects invalid content structure', () => {
      const testCodec = Schema.Struct({
        title: Schema.String
      });

      const dataCodec = strapiDataC(testCodec);

      const invalidData = {
        data: {
          id: 'not-a-number',
          attributes: {
            title: 'Test Title'
          }
        }
      };

      const result = Schema.decodeUnknownEither(dataCodec)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('strapiDataArrC codec factory', () => {
    it('validates array data wrapper with valid content', () => {
      const testCodec = Schema.Struct({
        name: Schema.String
      });

      const arrayCodec = strapiDataArrC(testCodec);

      const validData = {
        data: [
          {
            id: 1,
            attributes: {
              name: 'Item 1'
            }
          },
          {
            id: 2,
            attributes: {
              name: 'Item 2'
            }
          }
        ]
      };

      const result = Schema.decodeUnknownEither(arrayCodec)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.data).not.toBeNull();
        if (result.right.data && Array.isArray(result.right.data)) {
          expect(result.right.data).toHaveLength(2);
          expect(result.right.data[0].attributes.name).toBe('Item 1');
          expect(result.right.data[1].attributes.name).toBe('Item 2');
        }
      }
    });

    it('validates empty array', () => {
      const testCodec = Schema.Struct({
        name: Schema.String
      });

      const arrayCodec = strapiDataArrC(testCodec);

      const validData = {
        data: []
      };

      const result = Schema.decodeUnknownEither(arrayCodec)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.data).not.toBeNull();
        if (result.right.data && Array.isArray(result.right.data)) {
          expect(result.right.data).toHaveLength(0);
        }
      }
    });

    it('validates null data', () => {
      const testCodec = Schema.Struct({
        name: Schema.String
      });

      const arrayCodec = strapiDataArrC(testCodec);

      const validData = {
        data: null
      };

      const result = Schema.decodeUnknownEither(arrayCodec)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.data).toBeNull();
      }
    });

    it('rejects invalid array item structure', () => {
      const testCodec = Schema.Struct({
        name: Schema.String
      });

      const arrayCodec = strapiDataArrC(testCodec);

      const invalidData = {
        data: [
          {
            id: 1,
            attributes: {
              name: 'Valid Item'
            }
          },
          {
            id: 'invalid',
            attributes: {
              name: 'Invalid Item'
            }
          }
        ]
      };

      const result = Schema.decodeUnknownEither(arrayCodec)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('strapiUpdatedC codec', () => {
    it('validates timestamps structure', () => {
      const validData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z'
      };

      const result = Schema.decodeUnknownEither(strapiUpdatedC)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual(validData);
      }
    });

    it('rejects non-string timestamps', () => {
      const invalidData = {
        createdAt: new Date(),
        updatedAt: '2023-12-01T15:30:00.000Z'
      };

      const result = Schema.decodeUnknownEither(strapiUpdatedC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });

    it('rejects missing timestamps', () => {
      const invalidData = {
        createdAt: '2023-12-01T10:00:00.000Z'
        // missing updatedAt
      };

      const result = Schema.decodeUnknownEither(strapiUpdatedC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('strapiBaseC codec', () => {
    it('validates complete base structure', () => {
      const validData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z'
      };

      const result = Schema.decodeUnknownEither(strapiBaseC)(validData);
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual(validData);
      }
    });

    it('rejects missing publishedAt field', () => {
      const invalidData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z'
        // missing publishedAt
      };

      const result = Schema.decodeUnknownEither(strapiBaseC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });

    it('rejects non-string publishedAt field', () => {
      const invalidData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: null
      };

      const result = Schema.decodeUnknownEither(strapiBaseC)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('Codec composition and nesting', () => {
    it('validates complex nested structure', () => {
      const complexCodec = Schema.Struct({
        meta: Schema.Struct({
          pagination: Schema.Struct({
            page: Schema.Number,
            pageCount: Schema.Number,
            pageSize: Schema.Number,
            total: Schema.Number
          })
        }),
        data: Schema.Union(
          Schema.Null,
          Schema.Array(Schema.Struct({
            id: Schema.Number,
            attributes: Schema.extend(
              strapiBaseC,
              Schema.Struct({
                title: Schema.String,
                active: Schema.Boolean
              })
            )
          }))
        )
      });

      const validData = {
        meta: {
          pagination: {
            page: 1,
            pageCount: 5,
            pageSize: 10,
            total: 50
          }
        },
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Complex Item',
              active: true
            }
          }
        ]
      };

      const result = Schema.decodeUnknownEither(complexCodec)(validData);
      expect(Either.isRight(result)).toBe(true);
    });

    it('handles partial failures in complex structures', () => {
      const complexCodec = Schema.Struct({
        meta: Schema.Struct({
          pagination: Schema.Struct({
            page: Schema.Number,
            pageCount: Schema.Number,
            pageSize: Schema.Number,
            total: Schema.Number
          })
        }),
        data: Schema.Union(
          Schema.Null,
          Schema.Array(Schema.Struct({
            id: Schema.Number,
            attributes: Schema.extend(
              strapiBaseC,
              Schema.Struct({
                title: Schema.String,
                count: Schema.Number
              })
            )
          }))
        )
      });

      const invalidData = {
        meta: {
          pagination: {
            page: 1,
            pageCount: 5,
            pageSize: 10,
            total: 50
          }
        },
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Valid Item',
              count: 42
            }
          },
          {
            id: 2,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Invalid Item',
              count: 'not-a-number'
            }
          }
        ]
      };

      const result = Schema.decodeUnknownEither(complexCodec)(invalidData);
      expect(Either.isLeft(result)).toBe(true);
    });
  });
});

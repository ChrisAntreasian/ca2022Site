import { describe, it, expect } from 'vitest';
import * as t from 'io-ts';
import { either as E } from 'fp-ts';
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

      const result = strapiMetaDataC.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
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

      const result = strapiMetaDataC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
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

      const result = strapiMetaDataC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
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

      const result = strapiMetaDataC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('withIdC codec factory', () => {
    it('creates codec that validates object with id and attributes', () => {
      const testCodec = t.type({
        name: t.string,
        active: t.boolean
      });

      const wrappedCodec = withIdC(testCodec);

      const validData = {
        id: 123,
        attributes: {
          name: 'Test Item',
          active: true
        }
      };

      const result = wrappedCodec.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.id).toBe(123);
        expect(result.right.attributes.name).toBe('Test Item');
      }
    });

    it('rejects invalid id type', () => {
      const testCodec = t.type({
        name: t.string
      });

      const wrappedCodec = withIdC(testCodec);

      const invalidData = {
        id: 'not-a-number',
        attributes: {
          name: 'Test Item'
        }
      };

      const result = wrappedCodec.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });

    it('rejects invalid attributes structure', () => {
      const testCodec = t.type({
        name: t.string,
        count: t.number
      });

      const wrappedCodec = withIdC(testCodec);

      const invalidData = {
        id: 123,
        attributes: {
          name: 'Test Item',
          count: 'not-a-number'
        }
      };

      const result = wrappedCodec.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('strapiDataC codec factory', () => {
    it('validates single data wrapper with valid content', () => {
      const testCodec = t.type({
        title: t.string
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

      const result = dataCodec.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).not.toBeNull();
        if (result.right.data) {
          expect(result.right.data.id).toBe(1);
          expect(result.right.data.attributes.title).toBe('Test Title');
        }
      }
    });

    it('validates data wrapper with null content', () => {
      const testCodec = t.type({
        title: t.string
      });

      const dataCodec = strapiDataC(testCodec);

      const validData = {
        data: null
      };

      const result = dataCodec.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).toBeNull();
      }
    });

    it('rejects invalid content structure', () => {
      const testCodec = t.type({
        title: t.string
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

      const result = dataCodec.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('strapiDataArrC codec factory', () => {
    it('validates array data wrapper with valid content', () => {
      const testCodec = t.type({
        name: t.string
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

      const result = arrayCodec.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).not.toBeNull();
        if (result.right.data && Array.isArray(result.right.data)) {
          expect(result.right.data).toHaveLength(2);
          expect(result.right.data[0].attributes.name).toBe('Item 1');
          expect(result.right.data[1].attributes.name).toBe('Item 2');
        }
      }
    });

    it('validates empty array', () => {
      const testCodec = t.type({
        name: t.string
      });

      const arrayCodec = strapiDataArrC(testCodec);

      const validData = {
        data: []
      };

      const result = arrayCodec.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).not.toBeNull();
        if (result.right.data && Array.isArray(result.right.data)) {
          expect(result.right.data).toHaveLength(0);
        }
      }
    });

    it('validates null data', () => {
      const testCodec = t.type({
        name: t.string
      });

      const arrayCodec = strapiDataArrC(testCodec);

      const validData = {
        data: null
      };

      const result = arrayCodec.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).toBeNull();
      }
    });

    it('rejects invalid array item structure', () => {
      const testCodec = t.type({
        name: t.string
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

      const result = arrayCodec.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('strapiUpdatedC codec', () => {
    it('validates timestamps structure', () => {
      const validData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z'
      };

      const result = strapiUpdatedC.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toEqual(validData);
      }
    });

    it('rejects non-string timestamps', () => {
      const invalidData = {
        createdAt: new Date(),
        updatedAt: '2023-12-01T15:30:00.000Z'
      };

      const result = strapiUpdatedC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });

    it('rejects missing timestamps', () => {
      const invalidData = {
        createdAt: '2023-12-01T10:00:00.000Z'
        // missing updatedAt
      };

      const result = strapiUpdatedC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('strapiBaseC codec', () => {
    it('validates complete base structure', () => {
      const validData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: '2023-12-01T16:00:00.000Z'
      };

      const result = strapiBaseC.decode(validData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toEqual(validData);
      }
    });

    it('rejects missing publishedAt field', () => {
      const invalidData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z'
        // missing publishedAt
      };

      const result = strapiBaseC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });

    it('rejects non-string publishedAt field', () => {
      const invalidData = {
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T15:30:00.000Z',
        publishedAt: null
      };

      const result = strapiBaseC.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('Codec composition and nesting', () => {
    it('validates complex nested structure', () => {
      const complexCodec = t.intersection([
        strapiMetaDataC,
        strapiDataArrC(t.intersection([
          strapiBaseC,
          t.type({
            title: t.string,
            active: t.boolean
          })
        ]))
      ]);

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

      const result = complexCodec.decode(validData);
      expect(E.isRight(result)).toBe(true);
    });

    it('handles partial failures in complex structures', () => {
      const complexCodec = t.intersection([
        strapiMetaDataC,
        strapiDataArrC(t.intersection([
          strapiBaseC,
          t.type({
            title: t.string,
            count: t.number
          })
        ]))
      ]);

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

      const result = complexCodec.decode(invalidData);
      expect(E.isLeft(result)).toBe(true);
    });
  });
});

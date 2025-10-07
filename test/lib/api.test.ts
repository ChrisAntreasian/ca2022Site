import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { Schema, Effect } from 'effect';
import { Either } from 'effect';
import { getNoOpts, queryStr } from '../../src/lib/api';

// Mock SvelteKit error function
vi.mock('@sveltejs/kit', () => ({
  error: vi.fn((status: number, message: string) => {
    const err = new Error(message) as Error & { status: number };
    err.status = status;
    return err;
  })
}));

// Mock environment variables
vi.mock('$lib/api', async () => {
  const actual = await vi.importActual('../../src/lib/api');
  return {
    ...actual,
  };
});

// Simple test codec for validation
const testDataCodec = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  active: Schema.Boolean
});

// Mock environment variables for Vite
vi.mock('virtual:vite-env', () => ({
  VITE_BASE_API: 'https://test-api.com'
}));

describe('API Client Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock imporSchema.meta.env for the api module
    vi.stubEnv('VITE_BASE_API', 'https://test-api.com');
    
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('queryStr function', () => {
    it('builds query string with filters correctly', () => {
      const params = {
        filters: {
          name: { $eq: 'test' },
          active: true
        },
        populate: ['images', 'metadata']
      };

      const result = queryStr(params);
      
      expect(result).toContain('filters');
      expect(result).toContain('populate');
      expect(typeof result).toBe('string');
    });

    it('handles empty filters', () => {
      const params = {
        filters: {},
        populate: 'images'
      };

      const result = queryStr(params);
      expect(result).toContain('populate=images');
    });

    it('handles array populate values', () => {
      const params = {
        populate: ['images', 'metadata', 'tags']
      };

      const result = queryStr(params);
      expect(result).toContain('populate');
    });

    it('handles string populate values', () => {
      const params = {
        populate: 'images'
      };

      const result = queryStr(params);
      expect(result).toBe('populate=images');
    });

    it('handles complex nested filters', () => {
      const params = {
        filters: {
          publishedAt: { $notNull: true },
          category: { name: { $eq: 'art' } },
          price: { $gte: 100, $lte: 500 }
        }
      };

      const result = queryStr(params);
      expect(result).toContain('filters');
      expect(typeof result).toBe('string');
    });
  });

  describe('HTTP Client Error Handling', () => {
    it('handles network request failures', async () => {
      // Mock fetch to reject
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const apiCall = getNoOpts(testDataCodec as any)('test-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isLeft(result)).toBe(true);
    });

    it('handles 404 responses correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Not found' })
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('nonexistent-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isLeft(result)).toBe(true);
    });

    it('handles 500 server errors correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Server error' })
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('failing-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isLeft(result)).toBe(true);
    });

    it('handles JSON parsing failures', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('bad-json-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isLeft(result)).toBe(true);
    });

    it('handles codec validation failures', async () => {
      // Mock successful fetch but invalid data structure
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'not-a-number', // Should be number
          name: 123, // Should be string
          // missing active property
        })
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('invalid-data-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe('Successful API Calls', () => {
    it('successfully processes valid API response', async () => {
      const mockData = {
        id: 1,
        name: 'Test Item',
        active: true
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue(mockData)
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('valid-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual(mockData);
      }
    });

    it('makes request with correct headers and method', async () => {
      const mockData = { id: 1, name: 'test', active: true };
      
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue(mockData)
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('test-endpoint');
      await Effect.runPromise(Effect.either(apiCall));

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test-endpoint'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'content-type': 'application/json; charset=utf-8'
          })
        })
      );
    });

    it('constructs correct API URL', async () => {
      const mockData = { id: 1, name: 'test', active: true };
      
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue(mockData)
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('test-resource');
      await Effect.runPromise(Effect.either(apiCall));

      // The API should make a request to the resource endpoint
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/test-resource');
      expect(options?.method).toBe('GET');
      expect((options as RequestInit)?.headers).toMatchObject({
        'content-type': 'application/json; charset=utf-8'
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty response data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue(null)
      });

      const nullableCodec = Schema.Union(testDataCodec, Schema.Null);
      const apiCall = getNoOpts(nullableCodec as unknown)('empty-endpoint');
      
      const result = await Effect.runPromise(Effect.either(apiCall));
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBeNull();
      }
    });

    it('handles undefined environment variables gracefully', async () => {
      vi.stubEnv('VITE_BASE_API', undefined);
      
      const apiCall = getNoOpts(testDataCodec as any)('test-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      // Should handle undefined base API - this would likely fail at fetch level
      expect(Either.isLeft(result)).toBe(true);
    });

    it('handles very large response data', async () => {
      const largeData = {
        id: 1,
        name: 'x'.repeat(10000), // Very long string
        active: true
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue(largeData)
      });

      const apiCall = getNoOpts(testDataCodec as unknown)('large-data-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect((result.right as { name: string }).name).toHaveLength(10000);
        expect((result.right as { id: number }).id).toBe(1);
      }
    });
  });

  describe('Request Timeout Handling', () => {
    it('handles slow network requests', async () => {
      // Mock a slow response
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            status: 200,
            ok: true,
            json: () => Promise.resolve({ id: 1, name: 'slow', active: true })
          }), 100)
        )
      );

      const apiCall = getNoOpts(testDataCodec as unknown)('slow-endpoint');
      const result = await Effect.runPromise(Effect.either(apiCall));
      
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual({ id: 1, name: 'slow', active: true });
      }
    });
  });
});

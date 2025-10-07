import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Either, Effect } from 'effect';
import { writeFsTE, mkKeyWDefault } from '../../src/lib/file';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn()
  }
}));

// Remove error mock - let it use the real error function

import * as fs from 'fs';

describe('File Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mkKeyWDefault', () => {
    it('extracts correct key from route path', () => {
      const result = mkKeyWDefault('routes/landing/data');
      expect(result).toBe('landing');
    });

    it('extracts key from poems route', () => {
      const result = mkKeyWDefault('routes/poems/data');
      expect(result).toBe('poems');
    });

    it('extracts key from the-quintuplapus route', () => {
      const result = mkKeyWDefault('routes/the-quintuplapus/data');
      expect(result).toBe('the-quintuplapus');
    });

    it('extracts key from the-souljuicer route', () => {
      const result = mkKeyWDefault('routes/the-souljuicer/data');
      expect(result).toBe('the-souljuicer');
    });

    it('extracts key from web-experience route', () => {
      const result = mkKeyWDefault('routes/web-experience/data');
      expect(result).toBe('web-experience');
    });

    it('extracts key from layout route', () => {
      const result = mkKeyWDefault('routes/layout/data');
      expect(result).toBe('layout');
    });

    it('returns default "resource" for invalid route', () => {
      const result = mkKeyWDefault('routes/invalid-route/data');
      expect(result).toBe('resource');
    });

    it('returns default "resource" for malformed path', () => {
      const result = mkKeyWDefault('invalid-path');
      expect(result).toBe('resource');
    });

    it('handles empty string', () => {
      const result = mkKeyWDefault('');
      expect(result).toBe('resource');
    });

    it('handles path with no route segment', () => {
      const result = mkKeyWDefault('routes//data');
      expect(result).toBe('resource');
    });
  });

  describe('writeFsTE', () => {
    it('writes file successfully and returns the original data', async () => {
      const mockData = { test: 'data' };
      const filename = 'test-file';
      
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const result = await Effect.runPromise(Effect.either(writeFsTE([mockData, filename])));

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual(mockData);
      }

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        './src/data/test-file.json',
        expect.stringContaining('"data":{"test":"data"}')
      );
    });

    it('includes timestamp in written data', async () => {
      const mockData = { test: 'data' };
      const filename = 'test-file';
      
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      
      const beforeTime = Date.now();
      await Effect.runPromise(Effect.either(writeFsTE([mockData, filename])));
      const afterTime = Date.now();

      const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      
      expect(writtenData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(writtenData.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('includes filename and data in written content', async () => {
      const mockData = { test: 'data', nested: { value: 42 } };
      const filename = 'complex-test';
      
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await Effect.runPromise(Effect.either(writeFsTE([mockData, filename])));

      const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      
      expect(writtenData.name).toBe(filename);
      expect(writtenData.data).toEqual(mockData);
    });

    it('handles write failure and returns error', async () => {
      const mockData = { test: 'data' };
      const filename = 'failing-file';
      
      vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('Write failed'));

      const result = await Effect.runPromise(Effect.either(writeFsTE([mockData, filename])));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect((result.left as { body: { message: string } }).body.message).toBe('Failed to write the data.');
      }
    });

    it('creates correct file path', async () => {
      const mockData = { test: 'data' };
      const filename = 'path-test';
      
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await Effect.runPromise(Effect.either(writeFsTE([mockData, filename])));

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        './src/data/path-test.json',
        expect.any(String)
      );
    });

    it('works with different data types', async () => {
      const testCases = [
        ['string data', 'string-test'],
        [42, 'number-test'],
        [['array', 'data'], 'array-test'],
        [null, 'null-test']
      ];

      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      for (const [data, filename] of testCases) {
        const result = await Effect.runPromise(Effect.either(writeFsTE([data, filename as string])));
        
        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toEqual(data);
        }
      }
    });
  });
});

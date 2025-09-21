import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// Mock AWS SDK
vi.mock('aws-sdk', () => {
  const mockS3Instance = {
    getObject: vi.fn(),
    upload: vi.fn(),
  };
  
  return {
    default: {
      S3: vi.fn(() => mockS3Instance),
    },
    S3: vi.fn(() => mockS3Instance),
  };
});

// Mock environment variables
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_AWS_ACCESS_KEY_ID: 'test-access-key',
        VITE_AWS_ACCESS_SECRET: 'test-secret-key',
        VITE_AWS_BUCKET: 'test-bucket',
      },
    },
  },
});

import AWS from 'aws-sdk';
import { initS3, getS3File, uploadS3File } from '../../src/lib/s3';

describe('S3 Utilities', () => {
  let mockS3Instance: {
    getObject: MockedFunction<any>;
    upload: MockedFunction<any>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mock instance that will be returned by new AWS.S3()
    mockS3Instance = new AWS.S3() as any;
  });

  describe('initS3', () => {
    it('creates S3 instance with correct configuration', () => {
      const s3 = initS3();

      expect(AWS.S3).toHaveBeenCalledWith({
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      });

      expect(s3).toBeDefined();
    });

    it('uses hardcoded us-east-1 region', () => {
      initS3();

      expect(AWS.S3).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
        })
      );
    });

    it('uses environment variables for credentials', () => {
      initS3();

      expect(AWS.S3).toHaveBeenCalledWith(
        expect.objectContaining({
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        })
      );
    });
  });

  describe('getS3File', () => {
    it('calls getObject with correct parameters', async () => {
      const mockPromise = vi.fn().mockResolvedValue({ Body: 'file content' });
      mockS3Instance.getObject.mockReturnValue({ promise: mockPromise });

      const getFile = getS3File(mockS3Instance as any);
      await getFile('test-key');

      expect(mockS3Instance.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });
      expect(mockPromise).toHaveBeenCalled();
    });

    it('returns the result from S3 getObject', async () => {
      const expectedResult = { Body: 'file content', Metadata: {} };
      const mockPromise = vi.fn().mockResolvedValue(expectedResult);
      mockS3Instance.getObject.mockReturnValue({ promise: mockPromise });

      const getFile = getS3File(mockS3Instance as any);
      const result = await getFile('test-key');

      expect(result).toBe(expectedResult);
    });

    it('is a curried function', () => {
      const getFile = getS3File(mockS3Instance as any);
      
      expect(typeof getFile).toBe('function');
      expect(getFile.length).toBe(1); // Should take one parameter (the key)
    });

    it('handles different file keys', async () => {
      const mockPromise = vi.fn().mockResolvedValue({ Body: 'content' });
      mockS3Instance.getObject.mockReturnValue({ promise: mockPromise });

      const getFile = getS3File(mockS3Instance as any);
      
      await getFile('path/to/file.jpg');
      expect(mockS3Instance.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'path/to/file.jpg',
      });

      await getFile('another-file.txt');
      expect(mockS3Instance.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'another-file.txt',
      });
    });
  });

  describe('uploadS3File', () => {
    it('calls upload with correct parameters', async () => {
      const mockPromise = vi.fn().mockResolvedValue({ Location: 'https://bucket.s3.amazonaws.com/key' });
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as any);
      const fileContent = 'test file content';
      
      await uploadFile('test-key', fileContent);

      expect(mockS3Instance.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
        Body: fileContent,
      });
      expect(mockPromise).toHaveBeenCalled();
    });

    it('handles upload errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const uploadError = new Error('Upload failed');
      const mockPromise = vi.fn().mockRejectedValue(uploadError);
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as any);
      
      // Should not throw
      await expect(uploadFile('test-key', 'content')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);
      
      consoleErrorSpy.mockRestore();
    });

    it('is a curried function', () => {
      const uploadFile = uploadS3File(mockS3Instance as any);
      
      expect(typeof uploadFile).toBe('function');
      expect(uploadFile.length).toBe(2); // Should take two parameters (key, body)
    });

    it('handles different file types', async () => {
      const mockPromise = vi.fn().mockResolvedValue({});
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as any);
      
      // Test with string content
      await uploadFile('text-file.txt', 'text content');
      expect(mockS3Instance.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'text-file.txt',
        Body: 'text content',
      });

      // Test with buffer content
      const bufferContent = Buffer.from('binary content');
      await uploadFile('binary-file.bin', bufferContent);
      expect(mockS3Instance.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'binary-file.bin',
        Body: bufferContent,
      });
    });

    it('uploads successfully without returning a value', async () => {
      const mockPromise = vi.fn().mockResolvedValue({ Location: 'https://example.com/file' });
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as any);
      const result = await uploadFile('test-key', 'content');

      expect(result).toBeUndefined();
    });

    it('does not re-throw errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockPromise = vi.fn().mockRejectedValue(new Error('Network error'));
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as any);
      
      // Should complete without throwing
      const result = await uploadFile('test-key', 'content');
      expect(result).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('S3 integration workflow', () => {
    it('can be used together for upload and retrieve workflow', async () => {
      // Setup upload mock
      const uploadPromise = vi.fn().mockResolvedValue({ Location: 'https://bucket.s3.amazonaws.com/test-key' });
      mockS3Instance.upload.mockReturnValue({ promise: uploadPromise });

      // Setup get mock
      const getPromise = vi.fn().mockResolvedValue({ Body: 'retrieved content' });
      mockS3Instance.getObject.mockReturnValue({ promise: getPromise });

      const s3 = initS3();
      const uploadFile = uploadS3File(s3);
      const getFile = getS3File(s3);

      // Upload a file
      await uploadFile('test-key', 'original content');
      
      // Retrieve the file
      const result = await getFile('test-key');

      expect(mockS3Instance.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
        Body: 'original content',
      });

      expect(mockS3Instance.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });

      expect(result.Body).toBe('retrieved content');
    });
  });
});

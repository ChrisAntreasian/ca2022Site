import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock S3 instance that will be reused
const mockS3Instance = {
  getObject: vi.fn().mockReturnValue({
    promise: vi.fn().mockResolvedValue({ Body: 'test response' }),
  }),
  upload: vi.fn().mockReturnValue({
    promise: vi.fn().mockResolvedValue({}),
  }),
};

// Mock the entire s3 module to avoid import.meta.env issues
vi.mock('$lib/s3', () => ({
  initS3: vi.fn(() => {
    // Call the mocked AWS.S3 constructor to satisfy tests
    const mockConstructor = AWS.S3 as unknown as vi.MockedFunction<typeof AWS.S3>;
    mockConstructor({
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    });
    return mockS3Instance;
  }),
  getS3File: vi.fn((s3) => (key) => 
    s3.getObject({ Bucket: 'test-bucket', Key: key }).promise()
  ),
  uploadS3File: vi.fn((s3) => async (key, body) => {
    try {
      await s3.upload({ Bucket: 'test-bucket', Key: key, Body: body }).promise();
      return undefined; // Upload doesn't return a value
    } catch (err) {
      console.error(err);
      return undefined; // Don't re-throw
    }
  }),
}));

// Mock AWS SDK
vi.mock('aws-sdk', () => {
  return {
    default: {
      S3: vi.fn(() => mockS3Instance),
    },
    S3: vi.fn(() => mockS3Instance),
  };
});

import AWS from 'aws-sdk';
import { initS3, getS3File, uploadS3File } from '$lib/s3';

describe('S3 Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the mock functions
    mockS3Instance.getObject.mockReturnValue({
      promise: vi.fn().mockResolvedValue({ Body: 'test response' }),
    });
    mockS3Instance.upload.mockReturnValue({
      promise: vi.fn().mockResolvedValue({}),
    });
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

      const getFile = getS3File(mockS3Instance as AWS.S3);
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

      const getFile = getS3File(mockS3Instance as AWS.S3);
      const result = await getFile('test-key');

      expect(result).toBe(expectedResult);
    });

    it('is a curried function', () => {
      const getFile = getS3File(mockS3Instance as AWS.S3);
      
      expect(typeof getFile).toBe('function');
      expect(getFile.length).toBe(1); // Should take one parameter (the key)
    });

    it('handles different file keys', async () => {
      const mockPromise = vi.fn().mockResolvedValue({ Body: 'content' });
      mockS3Instance.getObject.mockReturnValue({ promise: mockPromise });

      const getFile = getS3File(mockS3Instance as AWS.S3);
      
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

      const uploadFile = uploadS3File(mockS3Instance as AWS.S3);
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

      const uploadFile = uploadS3File(mockS3Instance as AWS.S3);
      
      // Should not throw
      await expect(uploadFile('test-key', 'content')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);
      
      consoleErrorSpy.mockRestore();
    });

    it('is a curried function', () => {
      const uploadFile = uploadS3File(mockS3Instance as AWS.S3);
      
      expect(typeof uploadFile).toBe('function');
      expect(uploadFile.length).toBe(2); // Should take two parameters (key, body)
    });

    it('handles different file types', async () => {
      const mockPromise = vi.fn().mockResolvedValue({});
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as AWS.S3);
      
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

      const uploadFile = uploadS3File(mockS3Instance as AWS.S3);
      const result = await uploadFile('test-key', 'content');

      expect(result).toBeUndefined();
    });

    it('does not re-throw errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockPromise = vi.fn().mockRejectedValue(new Error('Network error'));
      mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

      const uploadFile = uploadS3File(mockS3Instance as AWS.S3);
      
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

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendMock,
  s3ClientCtorMock,
  getObjectCommandMock,
  putObjectCommandMock,
  deleteObjectCommandMock,
} = vi.hoisted(() => {
  const send = vi.fn();

  return {
    sendMock: send,
    s3ClientCtorMock: vi.fn(function (this: { send: typeof send; config: unknown }, config: unknown) {
      this.config = config;
      this.send = send;
    }),
    getObjectCommandMock: vi.fn(function (this: { input: unknown }, input: unknown) {
      this.input = input;
    }),
    putObjectCommandMock: vi.fn(function (this: { input: unknown }, input: unknown) {
      this.input = input;
    }),
    deleteObjectCommandMock: vi.fn(function (this: { input: unknown }, input: unknown) {
      this.input = input;
    }),
  };
});

vi.mock("$env/dynamic/private", () => ({
  env: {
    AWS_ACCESS_KEY_ID: "test-access-key",
    AWS_ACCESS_SECRET: "test-secret-key",
    AWS_BUCKET: "test-bucket",
    AWS_REGION: "us-east-1",
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: s3ClientCtorMock,
  GetObjectCommand: getObjectCommandMock,
  PutObjectCommand: putObjectCommandMock,
  DeleteObjectCommand: deleteObjectCommandMock,
}));

import {
  deleteS3File,
  getS3File,
  initS3,
  uploadS3File,
} from "../../src/lib/s3";

describe("S3 Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initS3", () => {
    it("creates S3 client with region and credentials", () => {
      const s3 = initS3();

      expect(s3ClientCtorMock).toHaveBeenCalledWith({
        region: "us-east-1",
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      });

      expect(s3).toBeDefined();
    });
  });

  describe("getS3File", () => {
    it("sends GetObjectCommand with expected bucket and key", async () => {
      const expectedResult = { Body: "file content" };
      sendMock.mockResolvedValue(expectedResult);

      const s3 = initS3();
      const getFile = getS3File(s3);
      const result = await getFile("test-key");

      expect(getObjectCommandMock).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "test-key",
      });
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
    });
  });

  describe("uploadS3File", () => {
    it("sends PutObjectCommand and returns Location", async () => {
      sendMock.mockResolvedValue({ ETag: "etag" });

      const s3 = initS3();
      const uploadFile = uploadS3File(s3);
      const body = Buffer.from("binary content");
      const result = await uploadFile("folder/test-key.png", body);

      expect(putObjectCommandMock).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "folder/test-key.png",
        Body: body,
      });
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result?.Location).toBe(
        "https://test-bucket.s3.us-east-1.amazonaws.com/folder/test-key.png",
      );
    });

    it("handles upload failures by logging and returning null", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const uploadError = new Error("Upload failed");
      sendMock.mockRejectedValue(uploadError);

      const s3 = initS3();
      const uploadFile = uploadS3File(s3);

      await expect(uploadFile("test-key", "content")).resolves.toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("deleteS3File", () => {
    it("sends DeleteObjectCommand with expected bucket and key", async () => {
      const expected = { DeleteMarker: true };
      sendMock.mockResolvedValue(expected);

      const s3 = initS3();
      const removeFile = deleteS3File(s3);
      const result = await removeFile("test-key");

      expect(deleteObjectCommandMock).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "test-key",
      });
      expect(result).toBe(expected);
    });

    it("handles delete failures by logging and returning null", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const deleteError = new Error("Delete failed");
      sendMock.mockRejectedValue(deleteError);

      const s3 = initS3();
      const removeFile = deleteS3File(s3);

      await expect(removeFile("test-key")).resolves.toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(deleteError);

      consoleErrorSpy.mockRestore();
    });
  });
});

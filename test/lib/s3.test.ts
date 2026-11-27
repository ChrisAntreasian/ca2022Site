import { describe, it, expect, vi, beforeEach } from "vitest";

// Type-only import: `S3Client` is replaced by `vi.doMock` at runtime, and a type import is erased
// before evaluation, so this documents the client's shape without pulling the real module in.
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * aws-sdk v2 → v3 notes relevant to this file.
 *
 * - A client is constructed as `new S3Client({ region, credentials: {...} })`. v2 took flat
 *   `accessKeyId`/`secretAccessKey`; v3 nests them under `credentials`, so assertions check the nested
 *   shape rather than flat keys.
 * - There is no `.promise()` chain. `client.send(command)` returns a promise directly, so the double
 *   stubs `send` and tests assert against the command object that was handed over.
 * - The managed uploader (`s3.upload()`) moved to `Upload` in `@aws-sdk/lib-storage`, so upload tests
 *   assert against that module rather than a client method.
 *
 * Unlike the v2 version of this file, which mocked `#lib/s3` wholesale and therefore tested its own
 * stand-in rather than the helpers, these tests exercise the real module: only `$app/env/private`, the
 * client constructor and `Upload` are replaced.
 */

const mockSend = vi.fn();
const mockUploadDone = vi.fn();
let capturedUploadOptions: Array<{ client: unknown; params: unknown }> = [];
let clientConfig: Record<string, unknown> = {};

// Env values are set explicitly per test rather than read from `.env`, so the suite does not depend on
// a developer's real bucket credentials. Getters rather than snapshots, because `initS3` reads them at
// call time and several cases vary them.
const env: Record<string, string | undefined> = {};

vi.doMock("$app/env/private", () => ({
  get AWS_ACCESS_KEY_ID() {
    return env.AWS_ACCESS_KEY_ID;
  },
  get AWS_ACCESS_SECRET() {
    return env.AWS_ACCESS_SECRET;
  },
  get AWS_BUCKET() {
    return env.AWS_BUCKET;
  },
  get AWS_REGION() {
    return env.AWS_REGION;
  },
  VITE_AWS_ACCESS_KEY_ID: undefined,
  VITE_AWS_ACCESS_SECRET: undefined,
  VITE_AWS_BUCKET: undefined,
  VITE_AWS_REGION: undefined,
}));

/**
 * Stub the client constructor only, leaving the real command classes intact. `getS3File` and
 * `uploadS3File` build genuine commands, and "a GetObjectCommand was sent" is worth little if the test
 * fabricated its own stand-in. The factory is async for that reason: `vi.doMock` defers enough that
 * `importOriginal` is safe here, unlike a hoisted `vi.mock`.
 */
vi.doMock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();

  return {
    ...actual,
    S3Client: vi.fn(function (this: unknown, config: Record<string, unknown>) {
      clientConfig = config;

      return { send: mockSend };
    }),
  };
});

// `Upload` is mocked wholesale: real multipart choreography would contact AWS and re-test its library.
// What matters here is that the correct bucket, key and body reach the params handed to it.
vi.doMock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn(function (
    this: unknown,
    options: { client: unknown; params: unknown },
  ) {
    capturedUploadOptions.push(options);

    return { done: mockUploadDone };
  }),
}));

const loadS3 = async () => {
  vi.resetModules();
  clientConfig = {};
  capturedUploadOptions = [];

  return await import("../../src/lib/s3");
};

describe("S3 Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUploadOptions = [];
    clientConfig = {};

    env.AWS_ACCESS_KEY_ID = "test-access-key";
    env.AWS_ACCESS_SECRET = "test-secret-key";
    env.AWS_BUCKET = "test-bucket";
    delete env.AWS_REGION;

    mockSend.mockResolvedValue({ Body: "test response" });
    mockUploadDone.mockResolvedValue(undefined);
  });

  describe("initS3", () => {
    it("creates an S3Client with the v3 nested-credentials shape", async () => {
      const { initS3 } = await loadS3();

      const s3 = initS3();

      // v2 passed flat accessKeyId/secretAccessKey; v3 requires them nested under `credentials`.
      // Asserted on the captured config rather than the constructor spy, because `#lib/s3` does not
      // export `S3Client` — it only consumes it.
      expect(clientConfig).toEqual({
        region: "us-east-1",
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      });

      expect(s3).toBeDefined();
    });

    it("falls back to us-east-1 when AWS_REGION is unset", async () => {
      const { initS3 } = await loadS3();

      initS3();

      expect(clientConfig).toMatchObject({ region: "us-east-1" });
    });

    it("honours an AWS_REGION from the environment", async () => {
      env.AWS_REGION = "eu-west-2";

      const { initS3 } = await loadS3();

      initS3();

      expect(clientConfig).toMatchObject({ region: "eu-west-2" });
    });

    it("uses environment variables for credentials", async () => {
      const { initS3 } = await loadS3();

      initS3();

      expect(clientConfig).toMatchObject({
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      });
    });

    it("fails loudly when configuration is missing", async () => {
      delete env.AWS_BUCKET;

      const { initS3 } = await loadS3();

      // Editor modules call `initS3` at module scope, so a misconfigured editor route must surface the
      // problem there rather than build a client that fails later inside a network call. Kit's
      // `error()` is thrown synchronously and carries the message on `body.message`, not `message`.
      let caught: unknown;
      try {
        initS3();
        throw new Error("initS3 should have thrown for a missing bucket");
      } catch (err) {
        caught = err;
      }

      expect(caught).toMatchObject({
        status: 500,
        body: { message: expect.stringMatching(/Missing S3 configuration/) },
      });
    });
  });

  describe("getS3File", () => {
    it("sends a GetObjectCommand with the configured bucket and key", async () => {
      const { getS3File } = await loadS3();

      const getFile = getS3File({ send: mockSend } as unknown as S3Client);
      await getFile("test-key");

      // v3 has no `.promise()` to spy on, so what is asserted is the command actually sent.
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0] as {
        __proto__: { constructor: { name: string } };
        input: { Bucket?: string; Key?: string };
      };

      expect(
        command.constructor?.name ?? command.__proto__.constructor.name,
      ).toBe("GetObjectCommand");
      expect(command.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "test-key",
      });
    });

    it("returns the result from S3 getObject", async () => {
      const expectedResult = { Body: "file content", Metadata: {} };
      mockSend.mockResolvedValue(expectedResult);

      const { getS3File } = await loadS3();

      const getFile = getS3File({ send: mockSend } as unknown as S3Client);
      const result = await getFile("test-key");

      expect(result).toBe(expectedResult);
    });

    it("is a curried function", async () => {
      const { getS3File } = await loadS3();

      const getFile = getS3File({ send: mockSend } as unknown as S3Client);

      expect(typeof getFile).toBe("function");
      expect(getFile.length).toBe(1); // Should take one parameter (the key)
    });

    it("handles different file keys", async () => {
      const { getS3File } = await loadS3();

      const getFile = getS3File({ send: mockSend } as unknown as S3Client);

      await getFile("path/to/file.jpg");
      await getFile("another-file.txt");

      const inputs = mockSend.mock.calls.map(
        (call) =>
          (call[0] as { input: { Bucket?: string; Key?: string } }).input,
      );

      expect(inputs[0]).toMatchObject({
        Bucket: "test-bucket",
        Key: "path/to/file.jpg",
      });
      expect(inputs[1]).toMatchObject({
        Bucket: "test-bucket",
        Key: "another-file.txt",
      });
    });
  });

  describe("uploadS3File", () => {
    it("passes bucket, key and body to the managed uploader", async () => {
      const { uploadS3File } = await loadS3();

      const uploadFile = uploadS3File({
        send: mockSend,
      } as unknown as S3Client);
      const fileContent = "test file content";

      await uploadFile("test-key", fileContent);

      // v2 had `s3.upload()` on the client. v3 moved the managed uploader to `Upload` in
      // `@aws-sdk/lib-storage`, taking `{ client, params }` — so the assertion is on those params.
      expect(capturedUploadOptions).toHaveLength(1);
      expect(capturedUploadOptions[0].params).toMatchObject({
        Bucket: "test-bucket",
        Key: "test-key",
        Body: fileContent,
      });
      expect(mockUploadDone).toHaveBeenCalled();
    });

    it("hands the client it was curried with to Upload", async () => {
      const { uploadS3File } = await loadS3();

      const fakeClient = { send: mockSend } as unknown as S3Client;
      await uploadS3File(fakeClient)("test-key", "content");

      expect(capturedUploadOptions[0].client).toBe(fakeClient);
    });

    it("handles upload errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const uploadError = new Error("Upload failed");
      mockUploadDone.mockRejectedValue(uploadError);

      const { uploadS3File } = await loadS3();

      const uploadFile = uploadS3File({
        send: mockSend,
      } as unknown as S3Client);

      // Should not throw. v2 resolved to `undefined`; v3's failure sentinel is `null`, which the media
      // layer already treats as "the upload did not happen".
      await expect(uploadFile("test-key", "content")).resolves.toBeNull();

      expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);

      consoleErrorSpy.mockRestore();
    });

    it("is a curried function", async () => {
      const { uploadS3File } = await loadS3();

      const uploadFile = uploadS3File({
        send: mockSend,
      } as unknown as S3Client);

      expect(typeof uploadFile).toBe("function");
      expect(uploadFile.length).toBe(2); // Should take two parameters (key, body)
    });

    it("handles different file types", async () => {
      const { uploadS3File } = await loadS3();

      const uploadFile = uploadS3File({
        send: mockSend,
      } as unknown as S3Client);

      // Test with string content
      await uploadFile("text-file.txt", "text content");
      expect(capturedUploadOptions[0].params).toMatchObject({
        Bucket: "test-bucket",
        Key: "text-file.txt",
        Body: "text content",
      });

      // Test with buffer content
      const bufferContent = Buffer.from("binary content");
      await uploadFile("binary-file.bin", bufferContent);
      expect(capturedUploadOptions[1].params).toMatchObject({
        Bucket: "test-bucket",
        Key: "binary-file.bin",
        Body: bufferContent,
      });
    });

    it("returns what the managed uploader resolves to", async () => {
      mockUploadDone.mockResolvedValue({
        Location: "https://example.com/file",
      });

      const { uploadS3File } = await loadS3();

      const uploadFile = uploadS3File({
        send: mockSend,
      } as unknown as S3Client);
      const result = await uploadFile("test-key", "content");

      // v2's `upload().promise()` resolved to a `{ Location, Key }` envelope. v3's `Upload.done()`
      // resolves to the final PutObject output plus that same envelope, so callers can still read
      // `Location` if they want it — but no caller in this project currently does.
      expect(result).toMatchObject({ Location: "https://example.com/file" });
    });

    it("does not re-throw errors", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockUploadDone.mockRejectedValue(new Error("Network error"));

      const { uploadS3File } = await loadS3();

      const uploadFile = uploadS3File({
        send: mockSend,
      } as unknown as S3Client);

      // Should complete without throwing
      const result = await uploadFile("test-key", "content");
      expect(result).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("S3 integration workflow", () => {
    it("can be used together for upload and retrieve workflow", async () => {
      const { initS3, getS3File, uploadS3File } = await loadS3();

      mockUploadDone.mockResolvedValue({
        Location: "https://bucket.s3.amazonaws.com/test-key",
      });
      mockSend.mockResolvedValue({ Body: "retrieved content" });

      const s3 = initS3();
      const uploadFile = uploadS3File(s3);
      const getFile = getS3File(s3);

      // Upload a file
      await uploadFile("test-key", "original content");

      expect(capturedUploadOptions[0].params).toMatchObject({
        Bucket: "test-bucket",
        Key: "test-key",
        Body: "original content",
      });

      // Retrieve the file
      const result = await getFile("test-key");

      const command = mockSend.mock.calls[0][0] as {
        input: { Bucket?: string; Key?: string };
      };

      expect(command.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "test-key",
      });

      expect(result.Body).toBe("retrieved content");
    });
  });

  /**
   * `s3BodyToString` is where an object body becomes text, so the shapes it tolerates have to be the ones
   * aws-sdk v3 actually produces rather than the ones a double finds convenient.
   *
   * In Node, a `GetObjectCommand` response carries a `ChecksumStream`: a `Readable` subclass that verifies
   * the object's checksum while it is read, given `transformToString`, `transformToWebStream` and friends by
   * the SDK's stream mixin. It is not a string, not a Buffer, not a `Uint8Array`, and its
   * `Symbol.asyncIterator` is inherited rather than own. `dataStore.server` used to carry its own
   * normalizer accepting only a string or a Buffer, and the store tests handed it strings - so a bucket that
   * served an object correctly produced "Unexpected S3 object body" on every read while the suite stayed
   * green. These cases are the shape assertions that were missing.
   */
  describe("s3BodyToString", () => {
    /**
     * A stand-in for the body a real `GetObjectCommand` hands back in Node: the SDK stream-mixin accessors
     * are own members, and the async iterator lives on the prototype because `ChecksumStream` inherits it
     * from `Readable`. The inherited part is the load-bearing detail - the helper reads `Symbol.asyncIterator`
     * through the prototype chain, so a double that declares nothing would not exercise that.
     *
     * Building the shape by hand is also the only option in this runner: `resolve.conditions: ["browser"]`
     * makes `node:stream` resolve to a browser stream polyfill, which has no `Readable.toReadable`.
     */
    class FakeChecksumStream {
      private readonly payload: string;
      private accessorSeen = false;

      constructor(payload: string) {
        this.payload = payload;
      }

      get accessorUsed() {
        return this.accessorSeen;
      }

      async transformToString() {
        this.accessorSeen = true;

        return this.payload;
      }

      async *[Symbol.asyncIterator]() {
        yield Buffer.from(this.payload, "utf8");
      }
    }

    it("reads a ChecksumStream through the SDK's own accessor", async () => {
      const { s3BodyToString } = await loadS3();
      const json = '{"name":"poems"}';
      const body = new FakeChecksumStream(json);

      expect(await s3BodyToString(body)).toBe(json);
      // Reading through the accessor is not a convenience: the SDK applies the object's checksum
      // verification as it reads. A body that has the accessor must not be stepped past it, while a body
      // that has no accessor at all still iterates - see the async-iterable case below.
      expect(body.accessorUsed).toBe(true);
    });

    it("reads a body that only carries the byte-array accessor", async () => {
      const { s3BodyToString } = await loadS3();
      const json = '{"name":"layout"}';

      const body = {
        transformToUint8Array: async () => Buffer.from(json, "utf8"),
      };

      expect(await s3BodyToString(body)).toBe(json);
    });

    it("reads a Blob-shaped body through its own text method", async () => {
      const { s3BodyToString } = await loadS3();
      const json = '{"name":"landing"}';

      expect(await s3BodyToString({ text: async () => json })).toBe(json);
    });

    it("reads a body that is only an async iterable", async () => {
      const { s3BodyToString } = await loadS3();
      const json = '{"name":"terms-of-service"}';

      // Chunked the way a stream hands chunks over, because the iterable path is the one that decodes
      // collected bytes back to text: the payload is split in two and each piece arrives as its own Buffer.
      const bytes = Buffer.from(json, "utf8");
      const body = {
        async *[Symbol.asyncIterator]() {
          yield bytes.subarray(0, 9);
          yield bytes.subarray(9);
        },
      };

      expect(await s3BodyToString(body)).toBe(json);
    });

    it("keeps accepting the bodies that already arrive decoded", async () => {
      const { s3BodyToString } = await loadS3();
      const json = '{"name":"the-souljuicer"}';

      expect(await s3BodyToString(json)).toBe(json);
      expect(await s3BodyToString(Buffer.from(json, "utf8"))).toBe(json);
      expect(await s3BodyToString(new TextEncoder().encode(json))).toBe(json);
    });

    it("refuses a body that is no readable shape at all", async () => {
      const { s3BodyToString } = await loadS3();

      // A body of the wrong shape must be refused loudly rather than degraded: an `undefined` or an empty
      // string reads back as a corrupt payload, and an editor saving what it was handed would write the
      // corruption straight back into the bucket. Kit's `HttpError` carries the message on `body.message`
      // rather than on `message`, which is the same reason `content.server`'s `messageOf` looks there first.
      for (const body of [{ contents: "not a body" }, undefined, 42]) {
        const rejected = await s3BodyToString(body).catch(
          (err: unknown) => err,
        );

        expect(rejected).toMatchObject({
          status: 500,
          body: {
            message: expect.stringMatching(/Unexpected S3 object body/),
          },
        });
      }
    });
  });
});

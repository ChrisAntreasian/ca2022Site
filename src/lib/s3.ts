import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import {
  AWS_ACCESS_KEY_ID,
  AWS_ACCESS_SECRET,
  AWS_BUCKET,
  AWS_REGION,
  VITE_AWS_ACCESS_KEY_ID,
  VITE_AWS_ACCESS_SECRET,
  VITE_AWS_BUCKET,
  VITE_AWS_REGION,
} from "$app/env/private";

import { e500 } from "#lib/error";

const getS3Config = () => {
  const accessKeyId = AWS_ACCESS_KEY_ID ?? VITE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = AWS_ACCESS_SECRET ?? VITE_AWS_ACCESS_SECRET;
  const bucket = AWS_BUCKET ?? VITE_AWS_BUCKET;
  const region = AWS_REGION ?? VITE_AWS_REGION ?? "us-east-1";

  if (!accessKeyId?.trim() || !secretAccessKey?.trim() || !bucket?.trim()) {
    throw e500(
      "Missing S3 configuration. Set AWS_ACCESS_KEY_ID, AWS_ACCESS_SECRET, and AWS_BUCKET in the server environment.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
  };
};

export const initS3 = () =>
  (() => {
    const config = getS3Config();

    return new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  })();

/**
 * A lazily-created, per-process singleton S3 client.
 *
 * `initS3` reads and validates the configuration the moment it is called, which is correct for the
 * editor modules that call it at module scope — those only load on editor routes, where missing
 * config genuinely should fail loudly. A data store has a different shape of problem: a read path
 * wants to attempt S3, fall back if the bucket or credentials are absent, and still be able to talk
 * to AWS when they are present. Constructing the client on first use makes both halves work without
 * either call site knowing about the other.
 */
let lazyS3Client: S3Client | undefined;

export const getS3Client = () => {
  if (!lazyS3Client) {
    lazyS3Client = initS3();
  }

  return lazyS3Client;
};

/** The bucket name, or `undefined` when it is not configured. For callers that degrade instead of throwing. */
export const getOptionalS3Bucket = () => {
  const bucket = AWS_BUCKET ?? VITE_AWS_BUCKET;

  return bucket?.trim() ? bucket : undefined;
};

/** The stream mixin's `transformToString` half of an S3 object body. */
type SdkStreamBody = {
  transformToString: () => Promise<string>;
  transformToUint8Array?: () => Promise<Uint8Array>;
};

/** The other half: some runtimes hand over only the byte-array accessor. */
type SdkByteArrayBody = {
  transformToString?: () => Promise<string>;
  transformToUint8Array: () => Promise<Uint8Array>;
};

/**
 * Read an object's body as text.
 *
 * aws-sdk v2 returned `Body` as a Buffer, so callers could treat it as one directly. In v3 the shape depends
 * on the runtime and the operation, and assuming any one of them is what breaks a real read: in Node,
 * `GetObject` hands back a `ChecksumStream` - a Node `Readable` that validates the object's checksum while
 * it is consumed - wrapped in the SDK's stream mixin, which attaches `transformToString`,
 * `transformToUint8Array` and `transformToWebStream`. That object is not a string, not a Buffer, not a
 * `Uint8Array`, and its `Symbol.asyncIterator` is inherited rather than own, so a normalizer written for
 * the shapes a test happened to hand it throws the moment a real bucket answers.
 *
 * The mixin's own accessors come first on purpose: `transformToString` consumes the stream through the SDK,
 * which also applies the checksum verification an iterator loop would silently skip.
 */
export const s3BodyToString = async (body: unknown): Promise<string> => {
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");

  if (body instanceof Uint8Array) return new TextDecoder().decode(body);

  if (
    body &&
    typeof body === "object" &&
    typeof (body as SdkStreamBody).transformToString === "function"
  ) {
    return (body as SdkStreamBody).transformToString();
  }

  if (
    body &&
    typeof body === "object" &&
    typeof (body as SdkByteArrayBody).transformToUint8Array === "function"
  ) {
    const bytes = await (body as SdkByteArrayBody).transformToUint8Array();

    return new TextDecoder().decode(bytes);
  }

  // A `Blob`-like body (what a fetch-shaped runtime hands back) reads itself.
  if (
    body &&
    typeof body === "object" &&
    typeof (body as { text?: unknown }).text === "function"
  ) {
    return (body as { text: () => Promise<string> }).text();
  }

  // Chunk streaming, including a bare Node `Readable` that never received the mixin.
  if (
    body &&
    typeof body === "object" &&
    typeof (body as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function"
  ) {
    const chunks: Buffer[] = [];

    for await (const chunk of body as AsyncIterable<unknown>) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, "utf8"));
      } else if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
        // A Node Buffer is a Uint8Array, so the second test is for bytes that arrive as a plain array -
        // from an encoder in a test, or from a runtime that does not hand out Node Buffers at all.
        chunks.push(Buffer.from(chunk));
      } else if (chunk !== undefined) {
        // Anything else is coerced, which is what the v2-era normalizer did with a chunk it did not
        // recognise - and silently assuming a shape is the mistake this helper exists to stop making.
        chunks.push(Buffer.from(String(chunk)));
      }
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  throw e500("Unexpected S3 object body while reading content data.");
};

export const getS3File = (s3: S3Client) => async (k: string) =>
  s3.send(
    new GetObjectCommand({
      Bucket: getS3Config().bucket,
      Key: k,
    }),
  );

/**
 * Upload an object through the managed uploader.
 *
 * aws-sdk v2 exposed `s3.upload()`, which handled multipart uploads of large media automatically.
 * That helper does not exist on a v3 client: it moved to `Upload` in `@aws-sdk/lib-storage`, which
 * takes the client and the PutObject params separately and performs the same multipart choreography.
 * Multipart is what makes the editor's image uploads work for files over 5MB, so this cannot degrade
 * to a plain `PutObjectCommand`.
 */
export const uploadS3File =
  (s3: S3Client) => async (k: string, f: PutObjectCommandInput["Body"]) => {
    try {
      return await new Upload({
        client: s3,
        params: {
          Bucket: getS3Config().bucket,
          Key: k,
          Body: f,
        },
      }).done();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

export const deleteS3File = (s3: S3Client) => async (k: string) => {
  try {
    return await s3.send(
      new DeleteObjectCommand({
        Bucket: getS3Config().bucket,
        Key: k,
      }),
    );
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const headS3File = (s3: S3Client) => async (k: string) =>
  s3.send(
    new HeadObjectCommand({
      Bucket: getS3Config().bucket,
      Key: k,
    }),
  );

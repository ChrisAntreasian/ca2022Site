import AWS from "aws-sdk";

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

    return new AWS.S3({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
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
let lazyS3Client: AWS.S3 | undefined;

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

export const getS3File = (s3: AWS.S3) => async (k: string) =>
  s3
    .getObject({
      Bucket: getS3Config().bucket,
      Key: k,
    })
    .promise();

export const uploadS3File =
  (s3: AWS.S3) =>
  async (k: string, f: AWS.S3.Types.PutObjectRequest["Body"]) => {
    try {
      return await s3
        .upload({
          Bucket: getS3Config().bucket,
          Key: k,
          Body: f,
        })
        .promise();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

export const deleteS3File = (s3: AWS.S3) => async (k: string) => {
  try {
    return await s3
      .deleteObject({
        Bucket: getS3Config().bucket,
        Key: k,
      })
      .promise();
  } catch (err) {
    console.error(err);
    return null;
  }
};

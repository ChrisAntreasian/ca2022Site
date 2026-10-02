import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "$env/dynamic/private";

import { e500 } from "$lib/error";

const getS3Config = () => {
  const accessKeyId = env.AWS_ACCESS_KEY_ID ?? env.VITE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_ACCESS_SECRET ?? env.VITE_AWS_ACCESS_SECRET;
  const bucket = env.AWS_BUCKET ?? env.VITE_AWS_BUCKET;
  const region = env.AWS_REGION ?? env.VITE_AWS_REGION ?? "us-east-1";

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

export const getS3File = (s3: S3Client) => async (k: string) => {
  const config = getS3Config();

  return s3.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: k,
    }),
  );
};

const objectUrl = (bucket: string, region: string, key: string) =>
  `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key).replace(/#/g, "%23")}`;

export const uploadS3File =
  (s3: S3Client) =>
  async (k: string, f: PutObjectCommandInput["Body"]) => {
    const config = getS3Config();

    try {
      const result = await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: k,
          Body: f,
        }),
      );

      return {
        ...result,
        Location: objectUrl(config.bucket, config.region, k),
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

export const deleteS3File = (s3: S3Client) => async (k: string) => {
  const config = getS3Config();

  try {
    return await s3.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: k,
      }),
    );
  } catch (err) {
    console.error(err);
    return null;
  }
};

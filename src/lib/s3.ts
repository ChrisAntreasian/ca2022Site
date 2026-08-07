import AWS from "aws-sdk";

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

    return new AWS.S3({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });
  })();

export const getS3File = (s3: AWS.S3) => async (k) =>
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

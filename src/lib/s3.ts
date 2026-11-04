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

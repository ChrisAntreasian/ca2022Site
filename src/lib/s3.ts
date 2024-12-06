import * as AWS from "aws-sdk";

export const initS3 = () =>
  new AWS.S3({
    region: "us-east-1",
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_ACCESS_SECRET,
  });

export const getS3File = (s3: AWS.S3) => async (k) =>
  s3
    .getObject({
      Bucket: import.meta.env.VITE_AWS_BUCKET,
      Key: k,
    })
    .promise();

export const uploadS3File =
  (s3: AWS.S3) =>
  async (k: string, f: AWS.S3.Types.PutObjectRequest["Body"]) => {
    try {
      const stored = await s3
        .upload({
          Bucket: import.meta.env.VITE_AWS_BUCKET,
          Key: k,
          Body: f,
        })
        .promise();
    } catch (err) {
      console.error(err);
    }
  };

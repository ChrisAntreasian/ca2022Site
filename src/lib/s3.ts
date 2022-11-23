import type { S3 } from "aws-sdk";
import * as AWS from "aws-sdk";

const s3 = new AWS.S3({
	accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
	secretAccessKey: import.meta.env.VITE_AWS_ACCESS_SECRET
});

export const getS3File = async (k) => 
	s3.getObject({
		Bucket: import.meta.env.VITE_AWS_BUCKET,
		Key: k
	}).promise();

export const uploadS3File = async (k: string, f: S3.Types.PutObjectRequest["Body"]) => {
  console.log(f)
	try {
    const stored = await s3.upload({ 
			Bucket: import.meta.env.VITE_AWS_BUCKET, 
			Key: k, 
      Body: f 
		}).promise();
		
	} catch (err) {
		console.error(err);
  }
};
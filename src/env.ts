import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  ENABLE_CONTENT_EDITOR: {
    description:
      'Enables the content editor routes and the "Edit post" links when set to "true". Read at runtime.',
    schema: (value) => value?.trim(),
  },
  AWS_ACCESS_KEY_ID: {
    description: "AWS access key ID for the S3 upload client.",
    schema: (value) => value?.trim() || undefined,
  },
  AWS_ACCESS_SECRET: {
    description: "AWS secret access key for the S3 upload client.",
    schema: (value) => value?.trim() || undefined,
  },
  AWS_BUCKET: {
    description: "S3 bucket used for editor image uploads.",
    schema: (value) => value?.trim() || undefined,
  },
  AWS_REGION: {
    description: "AWS region for the S3 client; defaults to us-east-1.",
    schema: (value) => value?.trim() || "us-east-1",
  },
});

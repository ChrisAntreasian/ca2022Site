import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  ENABLE_CONTENT_EDITOR: {
    description:
      'Enables the content editor routes and the "Edit post" links when set to "true". Read at runtime.',
    schema: (value) => value?.trim(),
  },
  CONTENT_LIVE_SOURCE: {
    description:
      "Set to 's3' once draft/live content has been seeded into the bucket. Until then public pages read the on-disk copies, and releases are refused. Read at runtime.",
    schema: (value) => value?.trim() || undefined,
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
  VITE_AWS_ACCESS_KEY_ID: {
    description:
      "Legacy `VITE_`-prefixed alias of AWS_ACCESS_KEY_ID, from the pre-Kit-3 `import.meta.env.VITE_*` era.",
    schema: (value) => value?.trim() || undefined,
  },
  VITE_AWS_ACCESS_SECRET: {
    description:
      "Legacy `VITE_`-prefixed alias of AWS_ACCESS_SECRET, from the pre-Kit-3 `import.meta.env.VITE_*` era.",
    schema: (value) => value?.trim() || undefined,
  },
  VITE_AWS_BUCKET: {
    description:
      "Legacy `VITE_`-prefixed alias of AWS_BUCKET, from the pre-Kit-3 `import.meta.env.VITE_*` era.",
    schema: (value) => value?.trim() || undefined,
  },
  VITE_AWS_REGION: {
    description:
      "Legacy `VITE_`-prefixed alias of AWS_REGION, from the pre-Kit-3 `import.meta.env.VITE_*` era.",
    schema: (value) => value?.trim() || undefined,
  },
});

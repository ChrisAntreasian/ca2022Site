import { defineEnvVars } from "@sveltejs/kit/env";

/**
 * What a bucket prefix is allowed to look like: one path segment, lowercase.
 *
 * A prefix is the root every draft, live and history key hangs off, so a value containing a slash, a space
 * or `..` would let a store reach objects outside the prefix it was configured for - straight into the
 * objects another run of the app is writing. Rejecting that is cheaper than discovering it in a bucket
 * where two prefixes have been writing over each other.
 */
const S3_PREFIX_RX = /^[a-z0-9][a-z0-9-]*$/;

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
  CONTENT_S3_PREFIX: {
    description:
      'The bucket prefix every draft, live and history object is read from and written to. Left unset it is "data", which is where npm run seed:s3 puts the objects production reads. Set it to a single lowercase segment such as "dev-data" whenever the editor runs against a bucket that production also serves, so a dev draft, history snapshot or release cannot land on the objects a visitor is reading. A value must be one path segment because a prefix is the root of every key the store writes. Read at runtime.',
    schema: (value) => {
      const prefix = value?.trim();

      if (!prefix) return undefined;

      if (!S3_PREFIX_RX.test(prefix)) {
        throw new Error(
          `CONTENT_S3_PREFIX must be a single path segment of lowercase letters, digits and dashes, such as "dev-data"; got "${prefix}".`,
        );
      }

      return prefix;
    },
  },
  CONTENT_LOCAL_MIRROR: {
    description:
      'In S3 mode, also write a local copy of every draft, live and history object under src/data/. Left unset the mirror is on; "false" is the only value that switches it off. The copies are written, never read: while live content is in S3 every read still resolves to the bucket, so a stale local draft cannot be served to an editor and saved back over the newer real one. Read at runtime.',
    schema: (value) => value?.trim() || undefined,
  },
  EDITOR_EDIT_KEY: {
    description:
      "The secret a visitor posts to unlock the editor. Without it an enabled editor cannot be unlocked at all, so a misconfigured deploy exposes no edit routes. Read at runtime.",
    schema: (value) => value?.trim() || undefined,
  },
  EDITOR_SESSION_SECRET: {
    description:
      "Signs editor session cookies. If unset, sessions are signed with an ephemeral key and every unlock ends at the next cold start - the editor still works, but must be unlocked again after each deploy or idle shutdown. Read at runtime.",
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

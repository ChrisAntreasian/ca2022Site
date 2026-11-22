#!/usr/bin/env node
/**
 * Seed S3 with the content currently bundled in `src/data/`.
 *
 * Run outside the Vite/SvelteKit runtime on purpose: this is a one-off ops step, not part of the app. It
 * talks to S3 directly with @aws-sdk/client-s3 and reads the repo JSON from disk, so it needs none of the
 * `#lib` / `$app/env` aliases that only Vite resolves. The keys it writes match createS3DataStore exactly:
 *   <prefix>/draft/<name>.json
 *   <prefix>/live/<name>.json
 * where <prefix> is CONTENT_S3_PREFIX, or "data" when the app configures no prefix - which is what a public
 * page reads when CONTENT_LIVE_SOURCE=s3 (live, with the bundled copy as fallback).
 *
 * A dev-only prefix must be seeded on its own: nothing else in the bucket holds a draft for a prefix that
 * production never wrote, so an editor pointed at "dev-data" before this script has run against "dev-data"
 * has no draft to open.
 *
 * Idempotent per key/scope: an existing object is left alone unless --overwrite is set, so re-running does
 * not clobber edits already made in the bucket. layout.json and landing.json are included - without this,
 * a fresh bucket would serve them from the bundled fallback forever instead of from S3.
 *
 * Usage (Node 20+ reads .env with --env-file; put real keys in .env.local, never in .env.example):
 *   node --env-file=.env.local scripts/seed-s3.mjs
 *   node --env-file=.env.local scripts/seed-s3.mjs --overwrite
 *   node --env-file=.env.local scripts/seed-s3.mjs poems web-experience   # only these keys
 *   # seeding a dev-only prefix: put CONTENT_S3_PREFIX=dev-data in the env file being read, then
 *   node --env-file=.env.local scripts/seed-s3.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

/** Every key public pages read - mirrors ContentKey in src/lib/content.server.ts. */
const CONTENT_KEYS = [
  "landing",
  "layout",
  "poems",
  "terms-of-service",
  "the-quintuplapus",
  "the-souljuicer",
  "web-experience",
];

// The same prefix the app writes under, or the app and this seed would disagree: a seed into "data" leaves
// an editor reading "dev-data", and a seed into "dev-data" writes objects no public page will ever open.
// S3_DATA_PREFIX is this script's older name from before the app had a prefix of its own, kept so an
// existing run command keeps working.
const PREFIX =
  process.env.CONTENT_S3_PREFIX?.trim() ||
  process.env.S3_DATA_PREFIX?.trim() ||
  "data";

const requireEnv = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    console.error(
      `Missing ${name}. Pass --env-file=.env.local (or export the variable first).`,
    );
    process.exit(1);
  }

  return value;
};

const s3 = new S3Client({
  region: process.env.AWS_REGION?.trim() || "us-east-1",
  credentials: {
    accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("AWS_ACCESS_SECRET"),
  },
});

const bucket = requireEnv("AWS_BUCKET");

/** True when the object already exists in the bucket. Any other failure is fatal - never treat an
 *  outage as "absent", or a re-run would overwrite live content blind. */
const objectExists = async (key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const name = err?.name ?? "";
    const code = err?.$metadata?.httpStatusCode;

    if (
      name === "NotFound" ||
      name === "NoSuchKey" ||
      code === 404 ||
      code === "404"
    ) {
      return false;
    }

    throw err;
  }
};

const seedKey = async (name, { overwrite }) => {
  const file = path.join("src", "data", `${name}.json`);

  if (!fs.existsSync(file)) {
    console.log(`  ${name}: no bundled file at ${file}`);
    return;
  }

  // Store the raw repo copy verbatim - it is already { name, timestamp, data }, the exact envelope a
  // public read expects. Re-serializing here would risk drift against what the build ships as fallback.
  const body = fs.readFileSync(file, "utf8");

  for (const scope of ["draft", "live"]) {
    const key = `${PREFIX}/${scope}/${name}.json`;

    if (!overwrite && (await objectExists(key))) {
      console.log(`  ${key}: already present (use --overwrite to replace)`);
      continue;
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
      }),
    );

    console.log(`  ${key}: seeded`);
  }
};

const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
// Positional names (no leading dash) restrict which keys to seed; otherwise all keys.
const selected = args.filter((a) => !a.startsWith("--"));
const keys = selected.length ? selected : CONTENT_KEYS;

console.log(`Seeding s3://${bucket}/${PREFIX}/ from src/data/`);
console.log(`Keys: ${keys.join(", ")}`);
console.log(
  overwrite
    ? "Mode: overwrite existing objects"
    : "Mode: skip existing objects",
);

for (const name of keys) {
  await seedKey(name, { overwrite });
}

console.log("Done.");

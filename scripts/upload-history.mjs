#!/usr/bin/env node
/**
 * Backfill the history snapshots that only exist on this laptop into the bucket.
 *
 * `src/data/history/` holds two layouts at once. 61 snapshots are in the legacy flat layout
 * (`src/data/history/<name>/<ts>.json`), written before this repo had tiers; 11 are in the tiered layout
 * (`src/data/history/<tier>/<name>/<ts>.json`), written by the current store. The bucket holds 7 objects,
 * all tiered. So the 61 legacy copies exist in exactly one place, on a laptop, and no restore screen
 * running against S3 can see any of them.
 *
 *   src/data/history/poems/1785422044766.json  ->  <prefix>/history/legacy/poems/1785422044766.json
 *   src/data/history/draft/poems/111.json       ->  <prefix>/history/draft/poems/111.json
 *
 * <prefix> is CONTENT_S3_PREFIX, or "data" when nothing is configured - the same root `createS3DataStore`
 * and `scripts/seed-s3.mjs` use, because a backfill that picks a different root is a backfill no read will
 * ever look at. Pass `--prefix=data` to write the production root deliberately.
 *
 * DRY RUN BY DEFAULT. Nothing is PUT unless --apply is passed, and the plan is printed first either way.
 * A dry run that needs AWS credentials to print "which of these are already in the bucket" is a dry run
 * that cannot be run offline, so credentials are optional here: without them the plan is printed and the
 * existing-object check says so out loud.
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload-history.mjs              # print the plan, write nothing
 *   node --env-file=.env.local scripts/upload-history.mjs --apply      # upload what is missing
 *   node --env-file=.env.local scripts/upload-history.mjs --prefix=data --apply   # production root
 *   npm run upload:history                                             # the dry run, without the flags
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * The seven content keys a public page reads. Mirrors `ContentKey` in `src/lib/content-server.ts` - sorry,
 * `src/lib/content.server.ts` - exactly as `scripts/seed-s3.mjs` mirrors it. `about` is deliberately absent:
 * `src/data/about.json` is a real file and `about` is not a content key, so a snapshot filed under it is
 * something this backfill should report rather than upload.
 */
export const CONTENT_KEY_NAMES = [
  "landing",
  "layout",
  "poems",
  "terms-of-service",
  "the-quintuplapus",
  "the-souljuicer",
  "web-experience",
];

/** The only three words that name a tier. Anything else in that slot is a content key, or a mistake. */
export const HISTORY_TIERS = ["draft", "live", "legacy"];

/** The root production has always used, and the root `createS3DataStore` defaults to. */
export const DEFAULT_BACKFILL_PREFIX = "data";

const HISTORY_ROOT = "src/data/history";
const TIMESTAMP_RX = /^[1-9]\d*$/u;
const PREFIX_RX = /^[a-z0-9][a-z0-9-]*$/u;

/**
 * Turn a walked path into the part under `src/data/history/`, with separators normalized. A plan that
 * refused `path.relative`'s backslashes on purpose would reject the paths its own caller produces.
 */
const historyRelativePath = (localPath) => {
  const normalized = String(localPath).replace(/\\/gu, "/");
  const marker = normalized.indexOf(HISTORY_ROOT);

  if (marker === -1) return null;

  const rest = normalized
    .slice(marker + HISTORY_ROOT.length)
    .replace(/^\/+|\/+$/gu, "");

  if (rest.length === 0) return null;

  return rest;
};

/**
 * Decide what a snapshot should become, from its path and its body alone.
 *
 * Pure on purpose: no filesystem, no AWS, no process state. Every decision is a decision about a *path*, and
 * the card this script belongs to is about a path-decision bug - the flat layout being read as a tier, or a
 * tier directory being read as a content key.
 *
 * @param {{ path: string, size: number, body: string }[]} files
 * @param {{ prefix?: string }} [options]
 * @returns {{
 *   localPath: string,
 *   size: number,
 *   key: string | null,
 *   tier: string | null,
 *   name: string | null,
 *   timestamp: number | null,
 *   skipped: boolean,
 *   reason: string,
 *   warning?: string,
 * }[]} one row per input file, same order
 */
export const historyUploadPlan = (files, options = {}) => {
  const prefix = options.prefix ?? DEFAULT_BACKFILL_PREFIX;

  if (typeof prefix !== "string" || !PREFIX_RX.test(prefix)) {
    throw new Error(
      `Cannot backfill history under prefix "${prefix}": a prefix must be one ` +
        `lowercase path segment (${CONTENT_KEY_NAMES.length} objects' roots depend on it).`,
    );
  }

  return files.map((file) => {
    const row = {
      localPath: file.path,
      size: file.size,
      key: null,
      tier: null,
      name: null,
      timestamp: null,
      skipped: false,
      reason: "",
    };

    const skip = (reason) => ({ ...row, skipped: true, reason });

    const relative = historyRelativePath(file.path);

    if (relative === null) {
      return skip(
        `not a history snapshot: "${file.path}" is not under ${HISTORY_ROOT}/`,
      );
    }

    const segments = relative.split("/");
    let tier;
    let name;
    let fileName;
    let reason;

    if (segments.length === 2) {
      // No tier directory in the path at all. That is the legacy layout, and it is the whole reason this
      // script exists: the tier has to be inferred from the *absence* of a tier segment.
      [name, fileName] = segments;
      tier = "legacy";
      reason = `legacy flat layout: no tier segment in the path, so this is a ${HISTORY_TIERS[2]}-tier copy`;
    } else if (segments.length === 3 && HISTORY_TIERS.includes(segments[0])) {
      [tier, name, fileName] = segments;
      reason = `tier segment "${tier}" named in the path`;
    } else if (segments.length === 3) {
      return skip(
        `unrecognised path "${relative}": "${segments[0]}" is not one of ` +
          `${HISTORY_TIERS.join(", ")} and a legacy copy needs <name>/<timestamp>.json`,
      );
    } else if (segments.length === 1) {
      return skip(
        `unrecognised path "${relative}": ${segments[0]} sits directly in ` +
          `${HISTORY_ROOT}/ with no content key directory around it`,
      );
    } else {
      return skip(
        `unrecognised path "${relative}": too many directories for a snapshot ` +
          `(need <name>/<timestamp>.json or <tier>/<name>/<timestamp>.json)`,
      );
    }

    if (CONTENT_KEY_NAMES.includes(name) === false) {
      return skip(
        `"${name}" is not one of the content keys this repo serves ` +
          `(${CONTENT_KEY_NAMES.join(", ")}), so nothing would ever read ${relative}`,
      );
    }

    if (typeof fileName !== "string" || !fileName.endsWith(".json")) {
      return skip(
        `"${fileName}" is not a .json snapshot file, so its timestamp cannot be read from its name`,
      );
    }

    const stamp = fileName.slice(0, -".json".length);

    if (!TIMESTAMP_RX.test(stamp)) {
      return skip(
        `timestamp "${stamp}" in ${relative} is not a positive integer, so this repo's ` +
          `store would not list it as a version`,
      );
    }

    const timestamp = Number(stamp);
    let body = null;

    try {
      body = JSON.parse(String(file.body ?? ""));
    } catch (cause) {
      return skip(
        `${relative} does not parse as JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }

    const key = `${prefix}/history/${tier}/${name}/${stamp}.json`;

    // A body that disagrees with the path it is filed under is not a reason to skip the copy - it is a
    // reason to say so before something restores from it. The key is built from the path, so a mismatched
    // body is a version whose own text contradicts the number a restore screen was handed.
    const warning = (() => {
      if (body === null || typeof body !== "object") return undefined;

      const named = body.name;
      const bodyTimestamp = body.timestamp;

      if (typeof named === "string" && named !== name) {
        return `the body names content key "${named}", the path names "${name}"`;
      }

      if (typeof bodyTimestamp === "number" && bodyTimestamp !== timestamp) {
        return (
          `the body names timestamp ${bodyTimestamp}, which does not match the ` +
          `timestamp in its path (${timestamp})`
        );
      }

      return undefined;
    })();

    return {
      ...row,
      key,
      tier,
      name,
      timestamp,
      reason,
      ...(warning ? { warning } : {}),
    };
  });
};

// ---------------------------------------------------------------------------
// The part below is the only part that talks to the bucket, and it only runs when this file is invoked.
// ---------------------------------------------------------------------------

const optionalEnv = (name) => {
  const value = process.env[name]?.trim();

  return value ? value : null;
};

const requireEnv = (name) => {
  const value = optionalEnv(name);

  if (!value) {
    console.error(
      `Missing ${name}. Pass --env-file=.env.local (or export the variable first).`,
    );
    process.exit(1);
  }

  return value;
};

const makeClient = ({ required }) => {
  const accessKeyId = optionalEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = optionalEnv("AWS_ACCESS_SECRET");
  const bucket = optionalEnv("AWS_BUCKET");

  if (!accessKeyId || !secretAccessKey || !bucket) {
    if (!required) return null;

    requireEnv("AWS_ACCESS_KEY_ID");
  }

  return {
    bucket,
    s3: new S3Client({
      region: optionalEnv("AWS_REGION") ?? "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
};

/** One LIST for the whole history root. Read-only, and cheaper than one request per snapshot. */
const listHistoryKeys = async (s3, bucket, prefix) => {
  const keys = [];
  let continuation = undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/history/`,
        ContinuationToken: continuation,
      }),
    );

    for (const item of page.Contents ?? []) keys.push(item.Key);

    continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuation);

  return keys;
};

/**
 * The card's rule for "already there": read the object, and treat a successful GET as existence. Never
 * HeadObject - this repo's history probe has used GET for the same reason it uses it in the store.
 */
export const historyObjectExists = async (s3, bucket, key) => {
  try {
    await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const name = err?.name ?? "";
    const code = err?.$metadata?.httpStatusCode;

    if (
      name === "NotFound" ||
      name === "NoSuchKey" ||
      name === "NoSuchKeyException" ||
      code === 404 ||
      code === "404"
    ) {
      return false;
    }

    throw err;
  }
};

const walkSnapshots = (root) => {
  const files = [];

  for (const entry of fs.readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;

    const relative = path.join(entry.parentPath ?? entry.path, entry.name);

    files.push({
      path: relative,
      size: fs.statSync(relative).size,
      body: fs.readFileSync(relative, "utf8"),
    });
  }

  return files;
};

const main = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const help = args.includes("--help") || args.includes("-h");

  if (help) {
    console.log(
      [
        "upload-history.mjs - copy the history snapshots on disk into the bucket.",
        "",
        "  (no flags)   print the plan and what is already in the bucket, write nothing",
        "  --apply      PUT the snapshots the bucket does not have yet",
        "  --prefix=X   write that root instead of CONTENT_S3_PREFIX / the default root",
        "",
        "  npm run upload:history                 # dry run against the root .env.local configures",
        "  node --env-file=.env.local scripts/upload-history.mjs --prefix=data --apply",
        "                                       # the production root, deliberately",
      ].join("\n"),
    );

    return;
  }

  const configuredPrefix =
    args
      .find((arg) => arg.startsWith("--prefix="))
      ?.slice("--prefix=".length) ??
    optionalEnv("CONTENT_S3_PREFIX") ??
    optionalEnv("S3_DATA_PREFIX") ??
    DEFAULT_BACKFILL_PREFIX;

  if (!fs.existsSync(HISTORY_ROOT)) {
    console.error(`No ${HISTORY_ROOT}/ directory to backfill.`);
    process.exit(1);
  }

  const files = walkSnapshots(HISTORY_ROOT);
  const plan = historyUploadPlan(files, { prefix: configuredPrefix });
  const rows = plan.filter((row) => !row.skipped);
  const skips = plan.filter((row) => row.skipped);
  const counts = { legacy: 0, draft: 0, live: 0 };

  for (const row of rows) counts[row.tier] += 1;

  const client = makeClient({ required: apply });

  console.log(`Local snapshots walked: ${files.length} under ${HISTORY_ROOT}/`);
  console.log(
    `Target root: ${client ? `s3://${client.bucket}/` : "(no AWS credentials in this env file)"}${configuredPrefix}/history/`,
  );
  console.log(
    `Prefix source: ${
      args.some((arg) => arg.startsWith("--prefix="))
        ? "--prefix"
        : optionalEnv("CONTENT_S3_PREFIX")
          ? "CONTENT_S3_PREFIX"
          : optionalEnv("S3_DATA_PREFIX")
            ? "S3_DATA_PREFIX (this repo's older name for it)"
            : `the default root "${DEFAULT_BACKFILL_PREFIX}"`
    }`,
  );
  console.log(
    `Mode: ${
      apply
        ? "APPLY - objects will be written"
        : "dry run - nothing will be written (pass --apply to write)"
    }`,
  );

  if (configuredPrefix === DEFAULT_BACKFILL_PREFIX) {
    console.log(
      `Note: "${DEFAULT_BACKFILL_PREFIX}" is the root a public page reads. Objects written here are ` +
        `the objects the live site serves from.`,
    );
  }

  console.log(
    `Tiers: legacy ${counts.legacy}, draft ${counts.draft}, live ${counts.live}`,
  );

  if (skips.length > 0) {
    console.log(`\nReported, not uploaded (${skips.length}):`);

    for (const row of skips)
      console.log(`  SKIP ${row.localPath}: ${row.reason}`);
  }

  const warnings = rows.filter((row) => row.warning);

  if (warnings.length > 0) {
    console.log(`\nPlanned anyway, with a warning (${warnings.length}):`);

    for (const row of warnings) {
      console.log(`  WARNING ${row.localPath}: ${row.warning}`);
    }
  }

  console.log(`\nPlanned uploads (${rows.length}):`);

  for (const row of rows) {
    console.log(`  ${row.key}  <=  ${row.localPath}  [${row.reason}]`);
  }

  if (rows.length === 0) {
    console.log("\nNothing to upload.");

    return;
  }

  if (!client) {
    console.log(
      "\nExisting objects were not checked: this env file has no AWS credentials. The plan above is what " +
        "would be uploaded if the bucket were reachable.",
    );

    return;
  }

  const { bucket, s3 } = client;
  // Read-only, and the only bucket call a dry run makes.
  const listed = new Set(await listHistoryKeys(s3, bucket, configuredPrefix));

  console.log(
    `\nAlready in ${configuredPrefix}/history/: ${listed.size} object(s)`,
  );

  let written = 0;
  let already = 0;

  for (const row of rows) {
    // A dry run answers "already there?" from the one LIST it already made. The GET is only worth doing
    // when a PUT would really follow from its answer.
    const exists = listed.has(row.key)
      ? true
      : apply
        ? await historyObjectExists(s3, bucket, row.key)
        : false;

    if (exists) {
      already += 1;
      console.log(`  ${row.key}: already there, left alone`);
      continue;
    }

    if (!apply) {
      console.log(`  ${row.key}: would be uploaded`);
      continue;
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: row.key,
        Body: fs.readFileSync(row.localPath, "utf8"),
        ContentType: "application/json",
      }),
    );

    written += 1;
    console.log(`  ${row.key}: uploaded`);
  }

  console.log(
    apply
      ? `Done. Uploaded ${written}, left ${already} alone.`
      : `Dry run done. ${written} to upload, ${already} already there. Pass --apply to write.`,
  );
};

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  await main();
}

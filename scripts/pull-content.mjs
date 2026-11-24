#!/usr/bin/env node
/**
 * Card T4 — pull the bucket's draft, live and history back onto disk, dry run by default.
 *
 * T2 mirrors every bucket write into `src/data/`, which protects a laptop that is still working. It does
 * nothing for a disk that is gone: at that moment the only copy of the tree lives in a bucket nobody can
 * open. This script is the reverse of `scripts/seed-s3.mjs` — it reads the bucket and writes the local
 * store's own paths, so the rebuilt tree is a tree the app can actually open.
 *
 *   node --env-file=.env.local scripts/pull-content.mjs              # dry run
 *   node --env-file=.env.local scripts/pull-content.mjs --apply      # writes src/data/ from the bucket
 *   node --env-file=.env.local scripts/pull-content.mjs --apply --overwrite
 *
 * The pure parts (`pullLayoutPlan`, `pullWriteDecision`, `pullSummary`) decide mapping, clobbering and
 * layout refusals; only `main` lists, gets and writes. Tests cover the pure parts and the round trip
 * through the app's own filesystem store.
 *
 * ## Why the legacy tier is written flat
 *
 * The bucket names its pre-tier history `history/legacy/<name>/<ts>.json` (that is how T3 uploads it and
 * how `createS3DataStore` writes new legacy snapshots). `src/lib/dataStore.server.ts` names the same
 * history the **flat** `src/data/history/<name>/<ts>.json` — its legacy tier has no `legacy` directory in
 * front of it. A 1:1 copy of the bucket's names would land the only legacy snapshots in a directory the
 * local store reads as a content key called `legacy`, i.e. nowhere at all. So a bucket legacy key maps
 * onto the flat local legacy dir, and says so in its row. `test/lib/pull-content.test.ts` proves both
 * halves: the remap is readable by `fsDataStore`, and the 1:1 version is not.
 *
 * ## Where it refuses to be clever
 *
 * - Only the seven content keys this repo serves are pulled, and only from `draft/`, `live/` and
 *   `history/`. Anything else in the root is reported, not written.
 * - A key whose path is not one of the layouts the stores read is refused, not renamed.
 * - An existing local file is never replaced unless `--overwrite` is named. `src/data/live/` is
 *   git-tracked, so every write into it is reported as a content change to review as a diff.
 * - An object whose JSON does not parse is never written. A half-written local file is worse than a
 *   missing one: the app would serve it to an editor and let an editor save it back into the bucket.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

// The seven names and the tier words are T3's. Importing them keeps one list in the repo, because a pull
// that recognises a different set of names than the upload wrote would rebuild a different tree.
import {
  CONTENT_KEY_NAMES,
  DEFAULT_BACKFILL_PREFIX,
  HISTORY_TIERS,
  PREFIX_RX,
  TIMESTAMP_RX,
} from "./upload-history.mjs";

/**
 * The root the app's store defaults to (`DEFAULT_S3_PREFIX` in `src/lib/dataStore.server.ts`).
 *
 * Scripts in this repo do not import app modules - `#lib/*` points at TypeScript, which plain Node cannot
 * resolve. `test/lib/pull-content.test.ts` asserts this constant and the store's constant stay equal, so
 * a drift in either one fails a test rather than rebuilding the wrong tree.
 */
export const DEFAULT_PULL_PREFIX = DEFAULT_BACKFILL_PREFIX;

/** Records read from the root itself: `<prefix>/draft/<name>.json` and `<prefix>/live/<name>.json`. */
const RECORD_DIRS = ["draft", "live"];

const LISTED_DIRS = [...RECORD_DIRS, "history"];

const JSON_SUFFIX = ".json";

const contentKeyList = CONTENT_KEY_NAMES.map((name) => `  - ${name}`).join(
  "\n",
);

const layoutRow = ({
  key,
  bytes,
  localPath,
  kind,
  tier,
  name,
  timestamp,
  reason,
}) => ({
  key,
  bytes,
  localPath,
  kind,
  tier,
  name,
  timestamp,
  bad: false,
  reason,
});

const refusedRow = (key, bytes, reason) => ({
  key,
  bytes,
  localPath: null,
  kind: null,
  tier: null,
  name: null,
  timestamp: null,
  bad: true,
  reason,
});

const unrecognisedLayout = (key, prefix) =>
  `unrecognised history layout "${key}": expected ${prefix}/history/<name>/<timestamp>.json (legacy) or ${prefix}/history/<tier>/<name>/<timestamp>.json`;

const notAContentKey = (key, name) =>
  `"${name}" in "${key}" is not one of the content keys this repo serves:\n${contentKeyList}`;

/** Millisecond-timestamp file names, exactly as both stores name them. */
const parseTimestamp = (fileName) => {
  if (!fileName.endsWith(JSON_SUFFIX)) {
    return { error: `"${fileName}" is not a ${JSON_SUFFIX} file` };
  }

  const raw = fileName.slice(0, -JSON_SUFFIX.length);

  if (!TIMESTAMP_RX.test(raw)) {
    return { error: `timestamp "${raw}" is not a positive integer` };
  }

  const timestamp = Number(raw);

  if (!Number.isSafeInteger(timestamp)) {
    return { error: `timestamp "${raw}" is too large to name a file safely` };
  }

  return { timestamp };
};

const snapshotRow = ({
  key,
  bytes,
  prefix,
  tier,
  name,
  fileName,
  localDir,
}) => {
  if (!CONTENT_KEY_NAMES.includes(name)) {
    return refusedRow(key, bytes, notAContentKey(key, name));
  }

  const timestamp = parseTimestamp(fileName);

  if (timestamp.error) {
    return refusedRow(key, bytes, `${timestamp.error} in "${key}"`);
  }

  // A flat key and the bucket's legacy-tier key are the same snapshot under two names, and both belong in
  // the flat local legacy dir. Only the tier-named one has to explain that it moved.
  const moved = tier === "legacy" && fileNameMovedFromTier(key, prefix);

  return layoutRow({
    key,
    bytes,
    kind: "snapshot",
    tier: "legacy",
    name,
    timestamp: timestamp.timestamp,
    localPath: `${localDir}/${name}/${timestamp.timestamp}.json`,
    reason: moved
      ? `the bucket's legacy tier maps onto the flat src/data/history/${name}/ dir the local store reads legacy snapshots from`
      : "",
  });
};

/** True when the key names the legacy tier explicitly (`<prefix>/history/legacy/<name>/<ts>.json`). */
const fileNameMovedFromTier = (key, prefix) =>
  key.startsWith(`${prefix}/history/legacy/`);

const tieredRow = ({ key, bytes, tier, name, fileName }) => {
  if (!CONTENT_KEY_NAMES.includes(name)) {
    return refusedRow(key, bytes, notAContentKey(key, name));
  }

  const timestamp = parseTimestamp(fileName);

  if (timestamp.error) {
    return refusedRow(key, bytes, `${timestamp.error} in "${key}"`);
  }

  return layoutRow({
    key,
    bytes,
    kind: "snapshot",
    tier,
    name,
    timestamp: timestamp.timestamp,
    localPath: `src/data/history/${tier}/${name}/${timestamp.timestamp}.json`,
    reason: "",
  });
};

const historyRow = (key, bytes, prefix, inner) => {
  if (inner.length === 1) {
    // `<prefix>/history/<file>.json` — nothing wrote there. A name with no timestamp under it is not a
    // layout either store reads, and a pull does not guess which half the writer meant.
    return refusedRow(
      key,
      bytes,
      `${unrecognisedLayout(key, prefix)} — a file directly in ${prefix}/history/ is not a version of anything`,
    );
  }

  if (inner.length === 2) {
    const [first, fileName] = inner;

    if (HISTORY_TIERS.includes(first)) {
      return refusedRow(
        key,
        bytes,
        `${unrecognisedLayout(key, prefix)} — "${first}" is a tier name, and a tier directory holds <name>/<timestamp>.json`,
      );
    }

    return snapshotRow({
      key,
      bytes,
      prefix,
      tier: "legacy",
      name: first,
      fileName,
      localDir: "src/data/history",
    });
  }

  if (inner.length === 3) {
    const [first, name, fileName] = inner;

    if (!HISTORY_TIERS.includes(first)) {
      return refusedRow(key, bytes, unrecognisedLayout(key, prefix));
    }

    if (first === "legacy") {
      return snapshotRow({
        key,
        bytes,
        prefix,
        tier: "legacy",
        name,
        fileName,
        localDir: "src/data/history",
      });
    }

    return tieredRow({ key, bytes, tier: first, name, fileName });
  }

  return refusedRow(key, bytes, unrecognisedLayout(key, prefix));
};

const recordRow = (key, bytes, prefix, dir, segments) => {
  if (segments.length !== 2) {
    return refusedRow(
      key,
      bytes,
      `"${key}" is not a record: expected exactly ${prefix}/${dir}/<name>${JSON_SUFFIX}`,
    );
  }

  const fileName = segments[1];

  if (
    !fileName.endsWith(JSON_SUFFIX) ||
    fileName.length <= JSON_SUFFIX.length
  ) {
    return refusedRow(
      key,
      bytes,
      `"${fileName}" in "${key}" is not a ${JSON_SUFFIX} record file`,
    );
  }

  const name = fileName.slice(0, -JSON_SUFFIX.length);

  if (!CONTENT_KEY_NAMES.includes(name)) {
    return refusedRow(key, bytes, notAContentKey(key, name));
  }

  return layoutRow({
    key,
    bytes,
    kind: "record",
    tier: dir,
    name,
    timestamp: null,
    localPath: `src/data/${dir}/${name}.json`,
    reason: "",
  });
};

/**
 * Decide, without a filesystem or a bucket, where every listed object belongs on disk.
 *
 * @param {{ key: string, size: number }[]} objects
 * @param {{ prefix?: string }} [options]
 * @returns {(ReturnType<typeof layoutRow>|ReturnType<typeof refusedRow>)[]}
 */
export const pullLayoutPlan = (objects, options = {}) => {
  const prefix = validatePrefix(options.prefix);

  return (objects ?? []).map((object) => {
    const key = String(object?.key ?? "");
    const bytes = Number.isFinite(object?.size) ? Number(object.size) : 0;

    if (!key.startsWith(`${prefix}/`)) {
      return refusedRow(
        key,
        bytes,
        `"${key}" is not in the root this pull reads: a pull reads draft/, live/ or history/ under ${prefix}/ only — refusing`,
      );
    }

    const segments = key.slice(prefix.length + 1).split("/");

    if (segments.some((segment) => segment === "." || segment === "..")) {
      return refusedRow(
        key,
        bytes,
        `"${key}" would write outside src/data/ — refusing`,
      );
    }

    const [dir, ...inner] = segments;

    if (!LISTED_DIRS.includes(dir)) {
      return refusedRow(
        key,
        bytes,
        `"${key}" is not under a content directory: a pull reads draft/, live/ or history/ under ${prefix}/ only, and nothing else there is content this app serves`,
      );
    }

    if (dir === "history") {
      return historyRow(key, bytes, prefix, inner);
    }

    return recordRow(key, bytes, prefix, dir, segments);
  });
};

/**
 * Decide whether one planned pull happens, given what is already on disk and whether the human named
 * `--overwrite`. `body` is the bucket's bytes when they have been read: an unread object has no parse
 * decision, because the script has not seen it yet.
 *
 * @param {ReturnType<typeof pullLayoutPlan>[number]} row
 * @param {{ local?: { exists: boolean, size?: number }, overwrite?: boolean, body?: string }} options
 */
export const pullWriteDecision = (row, options = {}) => {
  const local = options.local ?? { exists: false };
  const overwrite = options.overwrite === true;
  const body = options.body;
  const identity = {
    key: row.key,
    localPath: row.localPath,
    tier: row.tier,
    bytes: row.bytes,
  };

  if (row.bad) {
    return {
      ...identity,
      action: "skip-bad",
      reason: row.reason,
      parseChecked: false,
    };
  }

  // `src/data/live/` is the one pulled directory git tracks (T2 un-ignored it). Everything else a pull
  // writes is working content the repo has agreed to ignore.
  const tracked = row.tier === "live";
  const trackedNote = tracked
    ? `src/data/${row.tier}/ is tracked by git, so this is a content change: review it as a diff before committing it`
    : undefined;

  if (local.exists && !overwrite) {
    const sizes =
      local.size === undefined
        ? "sizes not compared"
        : local.size === row.bytes
          ? `same ${row.bytes} bytes on both sides`
          : `local ${local.size} bytes, bucket ${row.bytes} bytes`;

    return {
      ...identity,
      action: "skip-existing",
      reason: tracked
        ? `${row.localPath} is already on disk (${sizes}) — ${trackedNote}, and replacing it needs --overwrite`
        : `${row.localPath} is already on disk (${sizes}) — pass --overwrite to replace it`,
      parseChecked: false,
    };
  }

  const write = {
    ...identity,
    action: /** @type {"write"} */ ("write"),
    reason: "",
    parseChecked: body !== undefined,
    ...(trackedNote ? { warning: trackedNote } : {}),
  };

  if (body === undefined) {
    return write;
  }

  try {
    JSON.parse(body);
  } catch {
    return {
      ...identity,
      action: "skip-bad",
      reason: `"${row.key}" does not parse as JSON — refusing to write it to ${row.localPath}`,
      parseChecked: true,
    };
  }

  return write;
};

/**
 * What a set of decisions adds up to. Kept separate so the numbers a run prints and the numbers a test
 * checks are the same numbers.
 *
 * @param {ReturnType<typeof pullWriteDecision>[]} decisions
 */
export const pullSummary = (decisions) => {
  let written = 0;
  let writtenBytes = 0;
  let skippedExisting = 0;
  let skippedBad = 0;
  let liveWrites = 0;

  for (const decision of decisions ?? []) {
    if (decision.action === "write") {
      written += 1;
      writtenBytes += Number(decision.bytes) || 0;

      if (decision.tier === "live") liveWrites += 1;
    } else if (decision.action === "skip-existing") {
      skippedExisting += 1;
    } else {
      skippedBad += 1;
    }
  }

  return {
    written,
    writtenBytes,
    skippedExisting,
    skippedBad,
    liveWrites,
  };
};

const listAll = async (s3, bucket, prefix) => {
  const objects = [];
  let continuationToken;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of page.Contents ?? []) {
      if (item.Key) {
        objects.push({ key: item.Key, size: Number(item.Size ?? 0) });
      }
    }

    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  return objects;
};

const listContents = async (s3, bucket, prefix) => {
  const found = [];
  const failures = [];

  for (const dir of LISTED_DIRS) {
    try {
      found.push(...(await listAll(s3, bucket, `${prefix}/${dir}/`)));
    } catch (err) {
      failures.push(`${prefix}/${dir}/: ${describeError(err)}`);
    }
  }

  return { objects: found, failures };
};

const getBody = async (s3, bucket, key) => {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  return response.Body.transformToString("utf8");
};

const localInfo = (localPath) => {
  if (localPath === null) return { exists: false };

  const absolute = path.resolve(process.cwd(), localPath);

  try {
    const stats = fs.statSync(absolute);

    return { exists: stats.isFile(), size: stats.size };
  } catch {
    return { exists: false };
  }
};

const optionalEnv = (name) => {
  const value = process.env[name]?.trim();

  return value ? value : null;
};

/** Same shape as `scripts/upload-history.mjs`: a script reports what is missing rather than guessing. */
const requireEnv = (name, why) => {
  if (optionalEnv(name)) return optionalEnv(name);

  console.error(
    `Missing ${name}. A pull has to list and read the bucket before it can write anything local, so a pull needs it: pass --env-file=.env.local (or export the variable first). ${why}`.trimEnd(),
  );
  process.exit(1);
};

const makeClient = () => {
  const bucket = optionalEnv("AWS_BUCKET");

  if (!bucket) {
    requireEnv(
      "AWS_BUCKET",
      "This repo keeps the bucket name in AWS_BUCKET; the app reads the same bucket through its SvelteKit private env.",
    );
  }

  const accessKeyId = optionalEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = optionalEnv("AWS_ACCESS_SECRET");

  if (!accessKeyId || !secretAccessKey) {
    requireEnv(
      "AWS_ACCESS_KEY_ID",
      "and AWS_ACCESS_SECRET, as the other S3 scripts in this repo read them.",
    );
  }

  return {
    bucket,
    s3: new S3Client({
      region: optionalEnv("AWS_REGION") ?? "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
};

const validatePrefix = (raw) => {
  const prefix = raw === undefined ? DEFAULT_PULL_PREFIX : raw;

  if (typeof prefix !== "string" || !PREFIX_RX.test(prefix)) {
    throw new Error(
      `Cannot pull content under prefix ${JSON.stringify(prefix)}: a prefix must be one lowercase path segment (the same rule scripts/upload-history.mjs validates, because it is the root the app's store reads from).`,
    );
  }

  return prefix;
};

const resolvePrefix = (cliPrefix) => {
  const fromCli = typeof cliPrefix === "string" && cliPrefix.length > 0;
  const configured =
    optionalEnv("CONTENT_S3_PREFIX") ??
    optionalEnv("S3_DATA_PREFIX") ??
    DEFAULT_PULL_PREFIX;
  const prefix = validatePrefix(fromCli ? cliPrefix : configured);
  const source = fromCli
    ? "--prefix"
    : optionalEnv("CONTENT_S3_PREFIX")
      ? "CONTENT_S3_PREFIX"
      : optionalEnv("S3_DATA_PREFIX")
        ? "S3_DATA_PREFIX (this repo's older name for it)"
        : `the default root "${DEFAULT_PULL_PREFIX}"`;

  return { prefix, source };
};

const parseArgs = (argv) => {
  let prefix;
  let apply = false;
  let overwrite = false;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg === "--overwrite") {
      overwrite = true;
      continue;
    }

    if (arg.startsWith("--prefix=")) {
      prefix = arg.slice("--prefix=".length);
      continue;
    }

    if (arg === "--prefix") {
      throw new Error('--prefix needs a value: --prefix="<root>"');
    }

    throw new Error(
      `Unknown option "${arg}".\nUsage: pull-content.mjs [--prefix="<root>"] [--apply] [--overwrite]`,
    );
  }

  if (overwrite && !apply) {
    throw new Error(
      "--overwrite only means something with --apply: a dry run writes nothing, so nothing is replaced.",
    );
  }

  return { apply, overwrite, prefix };
};

const describeError = (err) => {
  const record = err && typeof err === "object" ? err : {};
  const code = String(record.name ?? record.code ?? "");
  const message = String(record.message ?? err);

  if (code === "NoSuchBucket") {
    return `no such bucket. Check CONTENT_S3_BUCKET (${message}).`;
  }

  if (code === "AccessDenied" || code === "InvalidAccessKeyId") {
    return `access denied for the bucket (${message}). Check CONTENT_S3_BUCKET and the Vercel project's linked S3 resource, then re-run.`;
  }

  if (
    code === "CredentialsProviderError" ||
    code === "MissingParameter" ||
    /credentials/u.test(message)
  ) {
    return `no AWS credentials. Link an S3 resource to the Vercel project, or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, then re-run (${message}).`;
  }

  return message;
};

const fmtBytes = (bytes) => {
  const value = Number(bytes) || 0;

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`;

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const verbFor = (decision, apply) => {
  if (decision.action === "write") {
    return apply ? "WRITE" : "COULD";
  }

  if (decision.action === "skip-existing") return "SKIP ";

  return "BAD  ";
};

const printPlan = ({
  bucket,
  prefix,
  source,
  apply,
  overwrite,
  rows,
  readFailures,
}) => {
  const writes = rows.filter((r) => r.decision.action === "write");
  const existing = rows.filter((r) => r.decision.action === "skip-existing");
  const bad = rows.filter((r) => r.decision.action === "skip-bad");

  console.log(`\n  ${apply ? "-- PULL: WRITING --" : "-- DRY RUN --"}`);
  console.log(`  Target root:  s3://${bucket}/${prefix}/`);
  console.log(`  Prefix from:  ${source}`);
  console.log(
    apply
      ? "  Mode:         WRITING into src/data/. Nothing was undone: a pull only adds or replaces files it names."
      : `  Mode:         dry run - nothing is written. Add --apply to write.${overwrite ? "" : " (--overwrite is off: an existing local file is left alone)"}`,
  );
  console.log(
    `  Object list:  ${rows.length} object(s) under ${LISTED_DIRS.map((dir) => `${prefix}/${dir}/`).join(", ")}`,
  );
  console.log(
    `  To write:     ${writes.length} (${fmtBytes(writes.reduce((n, r) => n + r.decision.bytes, 0))})`,
  );
  console.log(
    `  Local already: ${existing.length}, refused layouts: ${bad.length}`,
  );

  if (readFailures.length > 0) {
    console.log(
      `\n  LIST failures for: ${LISTED_DIRS.join(", ")} — reported per root:`,
    );

    for (const failure of readFailures) console.log(`    ${failure}`);
  }

  for (const group of [
    ["Would write / wrote", writes],
    ["Skipped, local copy already there", existing],
    ["Refused", bad],
  ]) {
    const [heading, groupRows] = group;

    if (groupRows.length === 0) continue;

    console.log(`\n  ${heading} (${groupRows.length}):`);

    for (const row of groupRows) {
      const decision = row.decision;
      const bytes = fmtBytes(decision.bytes);
      const target = decision.localPath ?? "(no local path)";

      console.log(
        `    ${verbFor(decision, apply)} ${target}  ${bytes}  <- ${row.key}`,
      );

      if (decision.reason) {
        for (const line of decision.reason.split("\n")) {
          console.log(`         ${line}`);
        }
      }

      if (decision.warning)
        console.log(`         WARNING: ${decision.warning}`);
    }
  }
};

const writeFiles = async (rows) => {
  for (const row of rows) {
    const absolute = path.resolve(process.cwd(), row.decision.localPath);

    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, row.body, "utf8");
  }
};

const main = async (argv) => {
  const { apply, overwrite, prefix: cliPrefix } = parseArgs(argv);
  const { bucket, s3 } = makeClient();
  const { prefix, source } = resolvePrefix(cliPrefix);

  const listed = await listContents(s3, bucket, prefix);
  const rows = pullLayoutPlan(listed.objects, { prefix });

  for (const row of rows) {
    row.local = localInfo(row.localPath);
    row.decision = pullWriteDecision(row, {
      local: row.local,
      overwrite,
    });
  }

  // Read everything that would be written before writing any of it. A pull that half-finished would leave
  // a tree that looks complete, and a tree that looks complete is what a restore is trusted with.
  const toRead = rows.filter((row) => row.decision.action === "write");
  const readFailures = [];

  for (const row of toRead) {
    try {
      row.body = await getBody(s3, bucket, row.key);
      row.decision = pullWriteDecision(row, {
        local: row.local,
        overwrite,
        body: row.body,
      });
    } catch (err) {
      readFailures.push(`${row.key}: ${describeError(err)}`);
      row.body = undefined;
      row.decision = {
        ...row.decision,
        action: "skip-bad",
        reason: `read failed: ${describeError(err)}`,
        parseChecked: false,
      };
    }
  }

  printPlan({
    bucket,
    prefix,
    source,
    apply,
    overwrite,
    rows,
    readFailures: [...listed.failures, ...readFailures],
  });

  const decider = rows.map((row) => row.decision);
  const summary = pullSummary(decider);
  const writable = rows.filter((row) => row.decision.action === "write");

  console.log(
    `\n  Summary:      ${apply ? "wrote" : "planned"} ${summary.written}, skipped-existing ${summary.skippedExisting}, skipped-bad ${summary.skippedBad}, live-tier writes ${summary.liveWrites}, bytes ${fmtBytes(summary.writtenBytes)}`,
  );

  if (apply && writable.length > 0) {
    await writeFiles(writable);
  }

  if (readFailures.length > 0 && apply) {
    throw new Error(
      `Refusing to write: ${readFailures.length} object(s) could not be read (${readFailures[0]}). A partial pull of the bucket would leave a local tree that looks whole.`,
    );
  }

  if (summary.liveWrites > 0) {
    console.log(
      `  Live tier:    ${summary.liveWrites} write(s) into src/data/live/ — git tracks that dir, so review the diff before committing.`,
    );
  }

  if (apply) {
    console.log(
      `  Done:         wrote ${writable.length} file(s) into src/data/ from s3://${bucket}/${prefix}/.`,
    );
  } else {
    console.log(
      `  Nothing written. To write these files: node --env-file=.env.local scripts/pull-content.mjs --apply${overwrite ? "" : "   (add --overwrite to replace files that already exist locally)"}`,
    );
  }

  return 0;
};

const invokedDirectly = (() => {
  const entry = process.argv[1];

  if (!entry) return false;

  return import.meta.url === pathToFileURL(entry).href;
})();

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      const message =
        err && typeof err.message === "string" && err.message.length > 0
          ? err.message
          : "Pull failed.";

      console.error(`\npull-content: ${message}`);
      process.exitCode = 1;
    });
}

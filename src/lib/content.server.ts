import {
  CONTENT_LIVE_SOURCE,
  CONTENT_LOCAL_MIRROR,
  CONTENT_S3_PREFIX,
  ENABLE_CONTENT_EDITOR,
} from "$app/env/private";

import bundledLanding from "#data/landing.json";
import bundledLayout from "#data/layout.json";
import bundledPoems from "#data/poems.json";
import bundledTermsOfService from "#data/terms-of-service.json";
import bundledQuintuplapus from "#data/the-quintuplapus.json";
import bundledSouljuicer from "#data/the-souljuicer.json";
import bundledWebExperience from "#data/web-experience.json";
import {
  createMirroringDataStore,
  createS3DataStore,
  DEFAULT_S3_PREFIX,
  fsDataStore,
  type DataScope,
  type DataStore,
} from "#lib/dataStore.server";

/**
 * The store public pages read content from.
 *
 * Phase 2 built the draft/live seam and `createJsonEditorStore`; this module is where a page actually
 * crosses it. Each resource module asks for one thing — `contentDataStore()` plus its own scope —
 * instead of importing a JSON file, so switching a resource to S3 changes one line in that module and
 * nothing a page can see. `terms-of-service` already worked this way with no static import; the four
 * pages that still import `#data` are what Phase 3 converts.
 *
 * Two tiers exist on purpose (plan §17, §21.1):
 *
 * - `"bundled"` — the repo copy imported at build time. Cannot fail because S3 is down.
 * - `"live"`    — the released copy in S3, falling back to the bundled payload when the bucket cannot serve.
 *
 * Bundling `layout` and `landing` is not an oversight. `layout.json` feeds nav, logo and `mobileTitle`
 * on every page, so serving it from S3 would turn a bucket outage into a broken shell rather than one
 * degraded page. `landing` is the entry point and earns the same treatment. Both are kept out of
 * `S3_CONTENT_KEYS` (no editor releases them yet) but when `CONTENT_LIVE_SOURCE=s3` they read the live
 * copy from S3 with their bundled payload as fallback - see `publicReadScope`. Without the flag they stay
 * pinned to bundle, so no code path serves them from the network.
 */
export type ContentTier = "bundled" | "live";

/**
 * The tier a read targets. Bundled content ignores S3 entirely, so a bundled read never fails due to
 * missing configuration — which is what keeps the site up during an outage.
 */
export type ContentScope = DataScope | "bundled";

/** Content keys public pages read. Mirrors the `#data` files, not the editor's key list. */
export type ContentKey =
  | "landing"
  | "layout"
  | "poems"
  | "terms-of-service"
  | "the-quintuplapus"
  | "the-souljuicer"
  | "web-experience";

/** The repo copies, so the store can offer them as fallbacks without a page importing them. */
const BUNDLED: Record<ContentKey, unknown> = {
  landing: bundledLanding,
  layout: bundledLayout,
  poems: bundledPoems,
  "terms-of-service": bundledTermsOfService,
  "the-quintuplapus": bundledQuintuplapus,
  "the-souljuicer": bundledSouljuicer,
  "web-experience": bundledWebExperience,
};

/** The serialized repo copy, byte-identical to how a store would have written it. */
const bundledJson = (name: ContentKey): string =>
  `${JSON.stringify(BUNDLED[name], null, 2)}\n`;

/**
 * Keys that can be served from S3, and therefore have a live tier an editor releases into. Everything
 * else is pinned to the bundle.
 */
export const S3_CONTENT_KEYS = [
  "poems",
  "the-quintuplapus",
  "the-souljuicer",
  "web-experience",
] as const satisfies ReadonlyArray<ContentKey>;

/** Keys deliberately pinned to the bundle so a bucket outage cannot reach them. */
export const BUNDLED_CONTENT_KEYS = [
  "landing",
  "layout",
] as const satisfies ReadonlyArray<ContentKey>;

/** Bundled payloads for `createS3DataStore`'s `fallbacks`, keyed by content key. */
const fallbacksFor = (): Record<string, string> =>
  Object.fromEntries(
    (Object.keys(BUNDLED) as ContentKey[]).map((key) => [
      key,
      bundledJson(key),
    ]),
  );

/**
 * Whether live content lives in S3. Opt-in rather than inferred from `ENABLE_CONTENT_EDITOR`: an editor
 * being enabled locally does not mean released content has been seeded into a bucket yet, and a page
 * that silently started reading drafts would serve unpublished work.
 *
 * The value comes from `$app/env/private`, not `process.env`. Kit 3 publishes private variables through
 * the env module and no longer mirrors them onto `process.env`, so a `process.env` read resolved to
 * `undefined` even when `.env.local` set the flag - the switch was silently off and every read stayed on
 * the filesystem store. Reading the same module the rest of the app reads keeps the two in step.
 */
export const isLiveContentFromS3 = () =>
  (CONTENT_LIVE_SOURCE ?? "").trim() === "s3";

/**
 * The bucket prefix every content object is read from and written to.
 *
 * `CONTENT_LIVE_SOURCE=s3` says *which store* a page uses; this says *which objects in that bucket*. A dev
 * server with the editor switched on and the same bucket as production shares `data/` with the site, so its
 * drafts, history snapshots and releases land on the objects visitors are reading. A separate prefix is the
 * only thing standing between the two, and it has to be one configuration item rather than a habit: the
 * store's own default stays `data` so a deploy that sets nothing keeps reading what `npm run seed:s3` put
 * there.
 */
export const contentS3Prefix = (): string =>
  (CONTENT_S3_PREFIX ?? "").trim() || DEFAULT_S3_PREFIX;

/**
 * Whether the local write mirror is on.
 *
 * Default on, and the only value that switches it off is `"false"`: a durability feature that needed to be
 * remembered would be the same as no feature at all, since the case it protects against - losing access to
 * the bucket - is the one case where nobody is configuring anything.
 *
 * Turning it off is allowed because the mirror is not free: a Vercel server has no durable disk, so the
 * local half of every write is an attempt to write a filesystem that will be wiped at the next cold start.
 * It is harmless rather than useful there, and a deploy that wants to say so out loud should be able to.
 */
export const isLocalMirrorEnabled = (): boolean =>
  (CONTENT_LOCAL_MIRROR ?? "").trim().toLowerCase() !== "false";

/** True when a key's public read is allowed to touch S3. */
const isInScope = (name: ContentKey, list: ReadonlyArray<ContentKey>) =>
  list.some((key) => key === name);

/**
 * The store a resource module reads and writes through.
 *
 * - Live content in S3 → the S3 store, with every bundled payload registered as a live fallback. Drafts
 *   land in durable storage. Unless `CONTENT_LOCAL_MIRROR=false`, the store is the mirroring wrapper, so
 *   every draft, history snapshot and release also lands under `src/data/` - reads still come from the
 *   bucket alone, because the copy exists to survive a lost bucket, not to be read as a second choice.
 * - Live content still bundled → the filesystem store, exactly as Phase 1 left it. A page's behaviour
 *   does not change; only which tier its read resolves to does. It already writes local copies itself, so
 *   there is nothing here to mirror.
 */
export const contentDataStore = (): DataStore => {
  if (!isLiveContentFromS3()) return fsDataStore;

  const s3 = createS3DataStore({
    prefix: contentS3Prefix(),
    fallbacks: fallbacksFor(),
  });

  return isLocalMirrorEnabled()
    ? createMirroringDataStore({ primary: s3, mirror: fsDataStore })
    : s3;
};

/**
 * The scope a content key's public read should use.
 *
 * Bundled keys report `"bundled"` so a resource module can pass it straight to `readFile` and get the
 * repo copy without S3 being configured at all. Live keys resolve to `"live"` once live content is in
 * S3, and to `"bundled"` while it is not — that is, to the payload the build actually ships.
 *
 * The non-S3 branch used to report `"draft"`, on the pre-S3 premise that the draft copy was the only
 * copy. That no longer holds: live-tier content now lives in the flat `src/data/<name>.json` files, and
 * `src/data/draft/` exists only once an editor has saved something or a seed has run. Resolving to
 * `"draft"` therefore made every live-tier page 500 with ENOENT on a fresh checkout, while bundled
 * pages kept rendering — the failure was inconsistent precisely because the tiers diverged here.
 *
 * `"bundled"` is also the honest answer for a public read: an unpublished draft must never be what a
 * visitor sees, and this keeps that true whether or not S3 is configured. Drafts remain reachable only
 * through the editor's own explicit `readFile()` call.
 */
export const publicReadScope = (name: ContentKey): ContentScope => {
  if (isInScope(name, BUNDLED_CONTENT_KEYS)) {
    // With live content in S3, layout and landing read the released copy too - createS3DataStore falls
    // back to their bundled payload on any bucket failure, so a failed read still renders the shell from
    // git. Without the flag they stay pinned to bundle exactly as before: no code path touches S3.
    return isLiveContentFromS3() ? "live" : "bundled";
  }

  return isLiveContentFromS3() && isInScope(name, S3_CONTENT_KEYS)
    ? "live"
    : "bundled";
};

/** Whether a release can be offered for this key. Bundled content has no live copy to overwrite. */
export const isReleasable = (name: ContentKey): boolean =>
  isInScope(name, S3_CONTENT_KEYS) && isLiveContentFromS3();

/**
 * Guard a release action. Two independent conditions must hold: the key must have a live tier to
 * overwrite, and the editor must be enabled — because once writes point at S3, releasing means mutating
 * durable storage rather than touching a repo file (plan §8). Both messages are deliberately vague to a
 * caller who is not an editor.
 */
export const requireReleasable = (name: ContentKey): void => {
  if (!isInScope(name, S3_CONTENT_KEYS)) {
    throw new Error(`Content key "${name}" has no live copy to release.`);
  }

  if (!isLiveContentFromS3()) {
    throw new Error(
      "Cannot release content while live content is still bundled (CONTENT_LIVE_SOURCE is not 's3').",
    );
  }

  if (ENABLE_CONTENT_EDITOR?.trim() !== "true") {
    throw new Error("Permission denied.");
  }
};

/** The serialized repo copy for a key, for callers that need it directly (tests, seeding). */
export const bundledContentJson = bundledJson;

/**
 * Read a public page's data for any content key through the store.
 *
 * `readPublicFile` returns the raw parsed JSON without an editor schema because layout and landing have
 * no editor resource yet - their shape is whatever the Strapi snapshot or seeded copy holds. The scope is
 * chosen by `publicReadScope`, so a bundled read never touches S3 and a live read falls back to the
 * bundled payload when the bucket cannot serve. This is the seam that lets a page switch from git-hosted
 * JSON to S3-driven content without changing what the page sees.
 */
export const readPublicFile = async <T>(name: ContentKey): Promise<T> => {
  const scope = publicReadScope(name);
  const source = await contentDataStore().readFile(name, scope);

  return JSON.parse(source) as T;
};

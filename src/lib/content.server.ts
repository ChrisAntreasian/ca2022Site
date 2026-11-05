import { ENABLE_CONTENT_EDITOR } from "$app/env/private";

import bundledLanding from "#data/landing.json";
import bundledLayout from "#data/layout.json";
import bundledPoems from "#data/poems.json";
import bundledTermsOfService from "#data/terms-of-service.json";
import bundledQuintuplapus from "#data/the-quintuplapus.json";
import bundledSouljuicer from "#data/the-souljuicer.json";
import bundledWebExperience from "#data/web-experience.json";
import {
  createS3DataStore,
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
 * degraded page. `landing` is the entry point and earns the same treatment. Both are deliberately kept
 * out of `S3_CONTENT_KEYS` so no code path can accidentally serve them from the network.
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
 */
export const isLiveContentFromS3 = () =>
  process.env.CONTENT_LIVE_SOURCE?.trim() === "s3";

/** True when a key's public read is allowed to touch S3. */
const isInScope = (name: ContentKey, list: ReadonlyArray<ContentKey>) =>
  list.some((key) => key === name);

/**
 * The store a resource module reads and writes through.
 *
 * - Live content in S3 → the S3 store, with every bundled payload registered as a live fallback. Drafts
 *   land in durable storage.
 * - Live content still bundled → the filesystem store, exactly as Phase 1 left it. A page's behaviour
 *   does not change; only which tier its read resolves to does.
 */
export const contentDataStore = (): DataStore =>
  isLiveContentFromS3()
    ? createS3DataStore({ fallbacks: fallbacksFor() })
    : fsDataStore;

/**
 * The scope a content key's public read should use.
 *
 * Bundled keys report `"bundled"` so a resource module can pass it straight to `readFile` and get the
 * repo copy without S3 being configured at all. Live keys resolve to `"live"` once live content is in
 * S3, and to `"draft"` while it is still on disk — pre-S3, the draft copy was the only copy.
 */
export const publicReadScope = (name: ContentKey): ContentScope => {
  if (isInScope(name, BUNDLED_CONTENT_KEYS)) return "bundled";

  return isLiveContentFromS3() && isInScope(name, S3_CONTENT_KEYS)
    ? "live"
    : "draft";
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

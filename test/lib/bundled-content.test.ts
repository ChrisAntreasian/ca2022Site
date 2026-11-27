import { describe, expect, it } from "vitest";
import { Result, Schema } from "effect";

import bundledLanding from "#data/landing.json";
import bundledLayout from "#data/layout.json";
import bundledPoems from "#data/poems.json";
import bundledTermsOfService from "#data/terms-of-service.json";
import bundledQuintuplapus from "#data/the-quintuplapus.json";
import bundledSouljuicer from "#data/the-souljuicer.json";
import bundledWebExperience from "#data/web-experience.json";

import type { ContentKey } from "#lib/content.server";

import { landingFileC } from "#lib/editing/resources/landing/landing";
import { layoutFileC } from "#lib/editing/resources/layout/layout";
import { poemsFileC } from "#lib/editing/resources/poems/poems";
import { quintuplapusFileC } from "#lib/editing/resources/quintuplapus/quintuplapus";
import { souljuicerFileC } from "#lib/editing/resources/souljuicer/souljuicer";
import { termsOfServiceFileC } from "#lib/editing/resources/terms-of-service/terms-of-service";
import { webExperienceFileC } from "#lib/editing/resources/web-experience/web-experience";

/**
 * Every bundled content payload must satisfy the codec that reads it.
 *
 * Why this exists: a page reports "Invalid <name> data file." when the payload it hands its own resource
 * codec fails to decode, and nothing else catches that. `#data/*.json` imports arrive as build-time JSON,
 * `Record<ContentKey, unknown>` hides whatever shape they carry, and the decode only happens at runtime on
 * a request - so a snapshot that drifted from its reader stays invisible until a visitor loads the page and
 * gets an error page instead.
 *
 * `src/data/web-experience.json` sat in exactly that state. Its single `page_details` entry carried
 * `createdAt/updatedAt/publishedAt/title/description/link/image` but no `poems` key, while `#typing/page`
 * declares `poems` as required (a Strapi relation the API always populates, even as `{ "data": [] }` - which
 * is what every `landing.json` section has). `/web-experience` therefore returned 500 on every tier -
 * bundled, live and draft alike - and no test noticed.
 *
 * These tests say nothing editorial. They assert only that the snapshot the build ships is a value the reader
 * accepts, which is the cheapest place to learn that a payload and its codec have diverged.
 */

/** The repo copies, in the same shape `#lib/content.server` bundles them. */
const BUNDLED_PAYLOADS: Record<ContentKey, unknown> = {
  landing: bundledLanding,
  layout: bundledLayout,
  poems: bundledPoems,
  "terms-of-service": bundledTermsOfService,
  "the-quintuplapus": bundledQuintuplapus,
  "the-souljuicer": bundledSouljuicer,
  "web-experience": bundledWebExperience,
};

/** `null` when the payload decodes, otherwise a one-line reason naming the key it rejects. */
const decodeFailure = <T>(
  name: ContentKey,
  codec: Schema.Codec<T, unknown>,
  payload: unknown,
): string | null => {
  const result = Schema.decodeResult(codec)(payload);

  if (Result.isSuccess(result)) {
    return null;
  }

  // Effect reports a schema failure as a `SchemaError` whose message is a tree of every path it rejected -
  // multi-line, and duplicated across each member of a union codec. Flattening it keeps the assertion diff
  // readable and puts one line per broken key next to the keys that decoded fine.
  const message = String(result.failure.message).replace(/\s+/g, " ").trim();

  return `${name}: ${message.slice(0, 300)}`;
};

/** Every payload/codec pair the app actually ships. */
const bundledFailures = (): string[] =>
  [
    decodeFailure("landing", landingFileC, bundledLanding),
    decodeFailure("layout", layoutFileC, bundledLayout),
    decodeFailure("poems", poemsFileC, bundledPoems),
    decodeFailure(
      "terms-of-service",
      termsOfServiceFileC,
      bundledTermsOfService,
    ),
    decodeFailure("the-quintuplapus", quintuplapusFileC, bundledQuintuplapus),
    decodeFailure("the-souljuicer", souljuicerFileC, bundledSouljuicer),
    decodeFailure("web-experience", webExperienceFileC, bundledWebExperience),
  ].filter((failure): failure is string => failure !== null);

describe("bundled content payloads", () => {
  it("decodes every repo copy through the codec that reads it", () => {
    // One assertion carrying every failure, because a payload usually has several bad keys at once and the
    // full list explains the payload better than stopping at the first.
    expect(bundledFailures()).toEqual([]);
  });

  it("checks a codec for every key the store can serve", async () => {
    const content = await import("#lib/content.server");

    // The store's own key lists are the authority on what a public page may read. A key added there without
    // a codec in this file is exactly the drift this suite exists to catch, so the assertion is written
    // against the lists rather than against a hardcoded copy of them.
    const storeKeys: ContentKey[] = [
      ...content.S3_CONTENT_KEYS,
      ...content.BUNDLED_CONTENT_KEYS,
      "terms-of-service",
    ];

    for (const key of storeKeys) {
      expect(Object.keys(BUNDLED_PAYLOADS)).toContain(key);
    }
  });

  it("checks the same values the store serves as fallbacks", async () => {
    const content = await import("#lib/content.server");

    // Proves the payloads above are the ones the store would hand a page, so this suite cannot be satisfied
    // by a private copy of the data that the app never reads.
    for (const key of Object.keys(BUNDLED_PAYLOADS) as ContentKey[]) {
      expect(JSON.parse(content.bundledContentJson(key))).toEqual(
        BUNDLED_PAYLOADS[key],
      );
    }
  });
});

import {
  describe,
  beforeAll,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

import { MissingSnapshotError } from "#lib/dataStore.server";
import type { DataStore, HistoryEntry } from "#lib/dataStore.server";

// The three server modules are loaded with a dynamic import further down, not statically here: each one builds
// its store the moment it loads, and the mocked `contentDataStore` has to be live before that happens — not
// during the import of this file. Only the pure helpers are static, and they know neither a store nor a tier.
import type { WebExperienceFile as WxFile } from "#lib/editing/resources/web-experience/web-experience";
import { restoreWebExperienceEntryFromSnapshot } from "#lib/editing/resources/web-experience/web-experience";
import type { QuintuplapusFile as QpFile } from "#lib/editing/resources/quintuplapus/quintuplapus";
import { restoreQuintuplapusEntryFromSnapshot } from "#lib/editing/resources/quintuplapus/quintuplapus";
import type { SouljuicerFile as SjFile } from "#lib/editing/resources/souljuicer/souljuicer";
import { restoreSouljuicerEntryFromSnapshot } from "#lib/editing/resources/souljuicer/souljuicer";
import { webExperienceEditorPath } from "#lib/editing/resources/web-experience/web-experience-editor";
import { quintuplapusEditorPath } from "#lib/editing/resources/quintuplapus/quintuplapus-editor";
import { souljuicerEditorPath } from "#lib/editing/resources/souljuicer/souljuicer-editor";

import { fakeCookies } from "../routes/fakeCookies";
import { loadResult } from "../routes/loadResult";

/**
 * Card T7 — the poems restore rule, rolled out to the three entry-list editors that were left behind.
 *
 * T5 built the seam (`restoreEntry`) and the poems rule that plugs into it; T6 built the poems screen around
 * them. What T7 adds is not a new rule. It is the same rule written three more times, once for each
 * resource's own shape, because "restore this entry" is decided by what an entry *is* in that resource: a
 * rich link with its own logo and screenshots for `web-experience`, one art piece inside one category for
 * `the-quintuplapus`, one page in a paginated list for `the-souljuicer`.
 *
 * So this file answers the same questions of each resource that `poems-restore.test.ts` answers of poems —
 * whose copy is the entry, which entries are not touched, where an entry the draft dropped lands, what may not
 * be re-stamped, what a version that never held the entry is told, and what a saved copy whose ids cannot be
 * trusted is told — and then wires each resource's server module through a fake `DataStore` to prove the tier
 * rule travels with it: a restore reads whatever tier it was given and writes exactly one tier, the draft.
 *
 * No bucket and no disk is involved. The fake store records its own calls in order, which is the only way the
 * ordering rule — a copy of the current draft exists *before* the new draft replaces it — is testable rather
 * than documentable.
 */

const NOW = new Date("2026-03-01T00:00:00.000Z");

// ------------------------------------------------------------------ web-experience

type WxLinkItem =
  WxFile["data"]["data"][number]["attributes"]["rich_links"]["data"][number];
type WxLinkAttributes = WxLinkItem["attributes"];

/** A `web-experience` image is a logo and a list of screenshots, not a url, and both belong to the entry. */
const wxImage = (id: number, url: string) => ({
  id,
  attributes: {
    url,
    name: `${url}.png`,
    mime: "image/png",
    ext: "png",
    hash: `hash${id}`,
    path: null,
    size: 1024,
    width: 800,
    height: 600,
  },
});

const wxLink = (
  id: number,
  overrides: Partial<WxLinkAttributes> = {},
): WxLinkItem => ({
  id,
  attributes: {
    createdAt: "2022-01-01T00:00:00.000Z",
    updatedAt: "2022-01-01T00:00:00.000Z",
    publishedAt: "2022-01-01T00:00:00.000Z",
    title: `Experience ${id}`,
    body: `body ${id}`,
    image: { data: [] },
    logo: { data: null },
    link: "https://example.com/one",
    secondLink: null,
    position: id,
    ...overrides,
  },
});

const wxPageAttributes = (
  overrides: Partial<WxFile["data"]["data"][number]["attributes"]>,
) => ({
  createdAt: "2022-01-01T00:00:00.000Z",
  updatedAt: "2022-01-01T00:00:00.000Z",
  publishedAt: "2022-01-01T00:00:00.000Z",
  title: "Page title",
  page_details: {
    data: [
      {
        id: 11,
        attributes: {
          createdAt: "2022-02-01T00:00:00.000Z",
          updatedAt: "2022-02-01T00:00:00.000Z",
          publishedAt: "2022-02-01T00:00:00.000Z",
          title: "Intro title",
          description: "Intro body",
          poems: { data: [] },
          link: null,
        },
      },
    ],
  },
  rich_links: { data: [] as WxLinkItem[] },
  ...overrides,
});

const wxFile = (input: {
  timestamp: number;
  page: ReturnType<typeof wxPageAttributes>;
}): WxFile => ({
  name: "web-experience",
  timestamp: input.timestamp,
  data: {
    data: [{ id: 1, attributes: input.page }],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 1 } },
  },
});

/**
 * A draft held with its rich links out of display order on purpose, exactly as the poems fixture holds its
 * poems out of date order: a rich link's index in the Strapi array is not its place on the page —
 * `toWebExperienceEditorValue` sorts the editor's list by each entry's own `position` — and a test that
 * assumed array index is display order would be looking at the wrong thing.
 *
 * Entry 7 is the one a later save deleted: version 700 holds it, this draft does not.
 */
const wxCurrentFile = (): WxFile =>
  wxFile({
    timestamp: 1000,
    page: wxPageAttributes({
      title: "Draft page title",
      page_details: {
        data: [
          {
            id: 11,
            attributes: {
              createdAt: "2021-02-01T00:00:00.000Z",
              updatedAt: "2021-02-01T00:00:00.000Z",
              publishedAt: "2021-02-01T00:00:00.000Z",
              title: "Draft intro title",
              description: "Draft intro body",
              poems: { data: [] },
              link: null,
            },
          },
        ],
      },
      rich_links: {
        data: [
          wxLink(3, {
            createdAt: "2023-01-03T00:00:00.000Z",
            updatedAt: "2024-01-03T00:00:00.000Z",
            publishedAt: "2023-01-03T00:00:00.000Z",
            title: "Newer keeper",
            body: "kept exactly as it is",
            position: 30,
            logo: { data: wxImage(91, "/media/keeper-logo") },
            image: { data: [wxImage(92, "/media/keeper-shot")] },
          }),
          wxLink(2, {
            createdAt: "2023-01-02T00:00:00.000Z",
            updatedAt: "2024-01-02T00:00:00.000Z",
            publishedAt: "2023-01-02T00:00:00.000Z",
            title: "Experience two current",
            body: "the body a later save wrote over it",
            position: 20,
          }),
          wxLink(1, {
            title: "Experience one",
            body: "one",
            position: 10,
          }),
        ],
      },
    }),
  });

/** Version 700: three experiences as they were, including a fourth the draft no longer holds. */
const wxSnapshotFile = (): WxFile =>
  wxFile({
    timestamp: 700,
    page: wxPageAttributes({
      title: "Snapshot page title",
      page_details: {
        data: [
          {
            id: 11,
            attributes: {
              createdAt: "2020-02-01T00:00:00.000Z",
              updatedAt: "2020-02-01T00:00:00.000Z",
              publishedAt: "2020-02-01T00:00:00.000Z",
              title: "Snapshot intro title",
              description: "Snapshot intro body",
              poems: { data: [] },
              link: null,
            },
          },
        ],
      },
      rich_links: {
        data: [
          wxLink(1, {
            createdAt: "2022-02-01T00:00:00.000Z",
            updatedAt: "2022-06-06T00:00:00.000Z",
            publishedAt: "2022-02-01T00:00:00.000Z",
            title: "Experience one as it was",
            body: "the body this version had",
            position: 10,
            logo: { data: wxImage(71, "/media/old-logo") },
            image: { data: [wxImage(72, "/media/old-shot")] },
          }),
          wxLink(7, {
            createdAt: "2022-03-01T00:00:00.000Z",
            updatedAt: "2022-07-07T00:00:00.000Z",
            publishedAt: "2022-03-01T00:00:00.000Z",
            title: "Experience seven, deleted since",
            body: "an entry nothing in the draft holds",
            position: 15,
          }),
          wxLink(2, {
            createdAt: "2022-04-01T00:00:00.000Z",
            updatedAt: "2022-08-08T00:00:00.000Z",
            publishedAt: "2022-04-01T00:00:00.000Z",
            title: "Experience two as it was",
            body: "what experience two used to say",
            position: 20,
          }),
        ],
      },
    }),
  });

const wxLinks = (file: WxFile): ReadonlyArray<WxLinkItem> =>
  file.data.data[0]?.attributes.rich_links?.data ?? [];

const wxLinkById = (file: WxFile, id: number) =>
  wxLinks(file).find((item) => item.id === id);

const wxPage = (file: WxFile) => file.data.data[0]?.attributes;

// -------------------------------------------------------------------- quintuplapus

type QpPieceItem =
  QpFile["data"]["data"][number]["attributes"]["art_pieces"]["data"][number];
type QpPieceAttributes = QpPieceItem["attributes"];

/** An `art_pieces[].attributes.image` entry, for the artwork a restored piece has to bring back. */
const savedImageAttrs = (id: number, url: string) => ({
  createdAt: "2019-05-05T00:00:00.000Z",
  updatedAt: "2019-05-05T00:00:00.000Z",
  alternativeText: "saved artwork",
  caption: "",
  provider: "strapi",
  provider_metadata: null,
  previewUrl: null,
  url,
  formats: {
    small: {
      ext: "png",
      height: 100,
      hash: `small${id}`,
      mime: "image/png",
      name: `${url}-small.png`,
      size: 512,
      url: `${url}-small.png`,
      width: 100,
      path: null,
    },
    thumbnail: {
      ext: "png",
      height: 50,
      hash: `thumb${id}`,
      mime: "image/png",
      name: `${url}-thumb.png`,
      size: 256,
      url: `${url}-thumb.png`,
      width: 50,
      path: null,
    },
  },
});

const savedImage = (id: number, url: string) => ({
  data: { id, attributes: savedImageAttrs(id, url) },
});

const qpPiece = (
  id: number,
  overrides: Partial<QpPieceAttributes> = {},
): QpPieceItem => ({
  id,
  attributes: {
    createdAt: "2022-01-01T00:00:00.000Z",
    updatedAt: "2022-01-01T00:00:00.000Z",
    publishedAt: "2022-01-01T00:00:00.000Z",
    title: `Piece ${id}`,
    createdDate: "2022-01-01",
    medium: "ink",
    description: `description ${id}`,
    order: id,
    image: { data: null },
    ...overrides,
  },
});

const qpCategoryAttributes = (
  overrides: Partial<QpFile["data"]["data"][number]["attributes"]>,
) => ({
  createdAt: "2022-01-01T00:00:00.000Z",
  updatedAt: "2022-01-01T00:00:00.000Z",
  publishedAt: "2022-01-01T00:00:00.000Z",
  title: "Category title",
  art_pieces: { data: [] as QpPieceItem[] },
  ...overrides,
});

const qpFile = (input: {
  timestamp: number;
  category: ReturnType<typeof qpCategoryAttributes>;
}): QpFile => ({
  name: "the-quintuplapus",
  timestamp: input.timestamp,
  data: {
    data: [{ id: 500, attributes: input.category }],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 1 } },
  },
});

/**
 * The draft's pieces are held out of `order` order, for the same reason as the rich links above.
 *
 * The one override a test needs is named here rather than written back into the file it returns:
 * `QuintuplapusFile` is Effect's output type, so every level of it is `readonly`, and a fixture that
 * wanted to add an `omit` list by assigning into it would be an assignment the compiler rightly refuses.
 */
const qpCurrentFile = (
  categoryOverrides: Partial<QpFile["data"]["data"][number]["attributes"]> = {},
): QpFile =>
  qpFile({
    timestamp: 1000,
    category: qpCategoryAttributes({
      title: "Draft category title",
      ...categoryOverrides,
      art_pieces: {
        data: [
          qpPiece(3, {
            createdAt: "2023-01-03T00:00:00.000Z",
            updatedAt: "2024-01-03T00:00:00.000Z",
            publishedAt: "2023-01-03T00:00:00.000Z",
            title: "Newer keeper",
            description: "kept exactly as it is",
            order: 30,
          }),
          qpPiece(2, {
            createdAt: "2023-01-02T00:00:00.000Z",
            updatedAt: "2024-01-02T00:00:00.000Z",
            publishedAt: "2023-01-02T00:00:00.000Z",
            title: "Piece two current",
            description: "the description a later save wrote over it",
            order: 20,
          }),
          qpPiece(1, {
            title: "Piece one",
            description: "one",
            order: 10,
          }),
        ],
      },
    }),
  });

const qpSnapshotFile = (): QpFile =>
  qpFile({
    timestamp: 700,
    category: qpCategoryAttributes({
      title: "Snapshot category title",
      art_pieces: {
        data: [
          qpPiece(1, {
            createdAt: "2022-02-01T00:00:00.000Z",
            updatedAt: "2022-06-06T00:00:00.000Z",
            publishedAt: "2022-02-01T00:00:00.000Z",
            title: "Piece one as it was",
            createdDate: "2019-05-05",
            medium: "gouache",
            description: "what piece one used to look like",
            order: 10,
            image: savedImage(71, "/media/old-piece"),
          }),
          qpPiece(7, {
            createdAt: "2022-03-01T00:00:00.000Z",
            updatedAt: "2022-07-07T00:00:00.000Z",
            publishedAt: "2022-03-01T00:00:00.000Z",
            title: "Piece seven, deleted since",
            description: "an entry nothing in the draft holds",
            order: 15,
          }),
          qpPiece(2, {
            createdAt: "2022-04-01T00:00:00.000Z",
            updatedAt: "2022-08-08T00:00:00.000Z",
            publishedAt: "2022-04-01T00:00:00.000Z",
            title: "Piece two as it was",
            description: "what piece two used to look like",
            order: 20,
          }),
        ],
      },
    }),
  });

const qpPieces = (file: QpFile): ReadonlyArray<QpPieceItem> =>
  file.data.data[0]?.attributes.art_pieces?.data ?? [];

const qpPieceById = (file: QpFile, id: number) =>
  qpPieces(file).find((item) => item.id === id);

const qpCategory = (file: QpFile) => file.data.data[0]?.attributes;
// -------------------------------------------------------------------- souljuicer

type SjEntryItem = SjFile["data"]["data"][number];
type SjEntryAttributes = SjEntryItem["attributes"];

const sjEntry = (
  id: number,
  overrides: Partial<SjEntryAttributes> = {},
): SjEntryItem => ({
  id,
  attributes: {
    createdAt: "2022-01-01T00:00:00.000Z",
    updatedAt: "2022-01-01T00:00:00.000Z",
    publishedAt: "2022-01-01T00:00:00.000Z",
    title: `Page ${id}`,
    createdDate: "2022-01-01",
    medium: "ink",
    order: id,
    description: `description ${id}`,
    image: { data: null },
    ...overrides,
  },
});

const sjFile = (timestamp: number, entries: SjEntryItem[]): SjFile => ({
  name: "the-souljuicer",
  timestamp,
  data: {
    data: entries,
    meta: {
      pagination: {
        page: 1,
        pageCount: entries.length > 0 ? 1 : 0,
        pageSize: 25,
        total: entries.length,
      },
    },
  },
});

/** The draft's pages are held out of `order` order, for the same reason as the rich links above. */
const sjCurrentFile = (): SjFile =>
  sjFile(1000, [
    sjEntry(3, {
      createdAt: "2023-01-03T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
      publishedAt: "2023-01-03T00:00:00.000Z",
      title: "Newer keeper",
      description: "kept exactly as it is",
      order: 30,
    }),
    sjEntry(2, {
      createdAt: "2023-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      publishedAt: "2023-01-02T00:00:00.000Z",
      title: "Page two current",
      description: "the description a later save wrote over it",
      order: 20,
    }),
    sjEntry(1, {
      title: "Page one",
      description: "one",
      order: 10,
    }),
  ]);

const sjSnapshotFile = (): SjFile =>
  sjFile(700, [
    sjEntry(1, {
      createdAt: "2022-02-01T00:00:00.000Z",
      updatedAt: "2022-06-06T00:00:00.000Z",
      publishedAt: "2022-02-01T00:00:00.000Z",
      title: "Page one as it was",
      createdDate: "2019-05-05",
      medium: "gouache",
      description: "what page one used to say",
      order: 10,
      image: savedImage(71, "/media/old-page"),
    }),
    sjEntry(7, {
      createdAt: "2022-03-01T00:00:00.000Z",
      updatedAt: "2022-07-07T00:00:00.000Z",
      publishedAt: "2022-03-01T00:00:00.000Z",
      title: "Page seven, deleted since",
      description: "an entry nothing in the draft holds",
      order: 15,
    }),
    sjEntry(2, {
      createdAt: "2022-04-01T00:00:00.000Z",
      updatedAt: "2022-08-08T00:00:00.000Z",
      publishedAt: "2022-04-01T00:00:00.000Z",
      title: "Page two as it was",
      description: "what page two used to say",
      order: 20,
    }),
  ]);

const sjEntries = (file: SjFile): ReadonlyArray<SjEntryItem> => file.data.data;

const sjEntryById = (file: SjFile, id: number) =>
  sjEntries(file).find((item) => item.id === id);
// -------------------------------------------------- the rules, asked of web-experience

describe("restoring one web experience entry out of a saved version", () => {
  it("replaces the restored entry with the version's own copy of it", () => {
    const from = wxSnapshotFile();
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: from,
      currentFile: wxCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    // "The snapshot's copy, all of it". A rich link is not a title and a body: it is a logo, a list of
    // screenshots, two links and a position, and hand-picking the fields the editor's own form has would
    // restore an entry that is part version and part today's.
    expect(wxLinkById(result, 1)).toEqual(wxLinkById(from, 1));
    expect(result.timestamp).toBe(NOW.getTime());
  });

  it("brings back an entry the draft no longer has, in the position its own saved position puts it", () => {
    const from = wxSnapshotFile();
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: from,
      currentFile: wxCurrentFile(),
      entryId: 7,
      now: NOW,
    });

    // Entry 7 is the one a later save deleted. The draft's own array is out of display order on purpose, so
    // "put it back where it belongs" is decided by the entry's saved `position` (15, between 10 and 20) and
    // not by an array index or an appended-at-the-end assumption.
    expect(wxLinks(result).map((item) => item.id)).toEqual([1, 7, 2, 3]);
    expect(wxLinkById(result, 7)).toEqual(wxLinkById(from, 7));
  });

  it("restores one entry and not the rest of the version it came from", () => {
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: wxSnapshotFile(),
      currentFile: wxCurrentFile(),
      entryId: 2,
      now: NOW,
    });

    expect(wxLinks(result).map((item) => item.id)).toEqual([1, 2, 3]);
    expect(wxLinkById(result, 2)).toEqual(wxLinkById(wxSnapshotFile(), 2));
    // Entry 1 was in this version too, with writing of its own, and it is not what the draft holds today.
    // The draft's copy is what stays.
    expect(wxLinkById(result, 1)?.attributes.body).toBe("one");
  });

  it("leaves every other entry exactly as the current draft held it", () => {
    const held = wxCurrentFile();
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: wxSnapshotFile(),
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    for (const id of [2, 3]) {
      expect(JSON.stringify(wxLinkById(result, id))).toBe(
        JSON.stringify(wxLinkById(held, id)),
      );
    }
  });

  it("keeps the version's own dates on the entry it restores, and stamps only the file", () => {
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: wxSnapshotFile(),
      currentFile: wxCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    // The entry's own dates are the version's, because that entry is the version's: stamping today on it
    // would make a restored entry look as though it had been written today, which is what the next save
    // reads an unchanged entry as.
    expect(wxLinkById(result, 1)?.attributes.updatedAt).toBe(
      "2022-06-06T00:00:00.000Z",
    );
    expect(wxLinkById(result, 1)?.attributes.createdAt).toBe(
      "2022-02-01T00:00:00.000Z",
    );

    // The draft's other entries keep the dates the draft held them with — the editor's own upsert re-stamps
    // every entry it writes, so without the patch below an untouched entry would arrive stamped.
    expect(wxLinkById(result, 2)?.attributes.updatedAt).toBe(
      "2024-01-02T00:00:00.000Z",
    );
    expect(wxLinkById(result, 3)?.attributes.updatedAt).toBe(
      "2024-01-03T00:00:00.000Z",
    );

    expect(result.timestamp).toBe(NOW.getTime());
  });

  it("carries the version's own logo and screenshots, which are what an entry's media is here", () => {
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: wxSnapshotFile(),
      currentFile: wxCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    expect(wxLinkById(result, 1)?.attributes.logo.data?.attributes.url).toBe(
      "/media/old-logo",
    );
    expect(
      wxLinkById(result, 1)?.attributes.image.data?.map(
        (image) => image.attributes.url,
      ),
    ).toEqual(["/media/old-shot"]);
  });

  it("leaves the page's own title and the intro exactly as the draft held them", () => {
    const held = wxCurrentFile();
    const result = restoreWebExperienceEntryFromSnapshot({
      snapshotFile: wxSnapshotFile(),
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    // The reused upsert re-stamps the page and re-writes its intro from the editor's projection of them,
    // which is what an ordinary save does to a page it saves. A restore of one rich link must not do that to
    // a page and an intro it was not asked about: the next save would read a restored entry as an edited
    // page title.
    // Neither the version's page (2020) nor a page the reused upsert re-stamped with today (2026): the
    // draft's own, held byte-for-byte.
    expect(wxPage(result)?.title).toBe("Draft page title");
    expect(wxPage(result)?.updatedAt).toBe("2022-01-01T00:00:00.000Z");
    expect(JSON.stringify(wxPage(result)?.page_details)).toBe(
      JSON.stringify(wxPage(held)?.page_details),
    );
  });

  it("says no, out loud, when that version never held the entry", () => {
    expect(() =>
      restoreWebExperienceEntryFromSnapshot({
        snapshotFile: wxSnapshotFile(),
        currentFile: wxCurrentFile(),
        entryId: 42,
        now: NOW,
      }),
    ).toThrow(/holds no web experience entry 42 to restore/);
  });

  it("refuses a saved copy it cannot trust an id from, instead of inventing or renaming one", () => {
    // A poisoned copy is what a corrupt column (`id: NaN` is what the corrupted `src/data/web-experience.json`
    // holds) or a plain `"id": 0` produces. Both questions get a loud answer and neither invents an id:
    // `upsertWebExperienceEditorValue` would have handed that entry the next free id in the file, which is a
    // rename into an id another version may already have restored.
    const poisoned = {
      ...wxSnapshotFile(),
      data: {
        ...wxSnapshotFile().data,
        data: [
          {
            ...wxSnapshotFile().data.data[0],
            attributes: {
              ...wxSnapshotFile().data.data[0].attributes,
              rich_links: {
                ...wxSnapshotFile().data.data[0].attributes.rich_links,
                data: wxLinks(wxSnapshotFile()).map((item) =>
                  item.id === 1 ? { ...item, id: 0 } : item,
                ),
              },
            },
          },
        ],
      },
    };

    expect(() =>
      restoreWebExperienceEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: wxCurrentFile(),
        entryId: 0,
        now: NOW,
      }),
    ).toThrow(/no id this restore can trust/);

    expect(() =>
      restoreWebExperienceEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: wxCurrentFile(),
        entryId: 1,
        now: NOW,
      }),
    ).toThrow(/holds no web experience entry 1 to restore/);
  });

  it("hands back a new file and leaves the two files it was given as it found them", () => {
    const held = wxCurrentFile();
    const from = wxSnapshotFile();
    const heldBefore = JSON.stringify(held);
    const fromBefore = JSON.stringify(from);

    restoreWebExperienceEntryFromSnapshot({
      snapshotFile: from,
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    expect(JSON.stringify(held)).toBe(heldBefore);
    expect(JSON.stringify(from)).toBe(fromBefore);
  });
});
// ---------------------------------------------------- the rules, asked of quintuplapus

describe("restoring one Quintuplapus entry out of a saved version", () => {
  it("replaces the restored piece with the version's own copy of it", () => {
    const from = qpSnapshotFile();
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: from,
      currentFile: qpCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    // A piece of this resource is a title, a date, a medium, a description, an order and an image. The
    // version's copy is all of those, and the editor's own projection of one field is not a substitute.
    expect(qpPieceById(result, 1)).toEqual(qpPieceById(from, 1));
    expect(result.timestamp).toBe(NOW.getTime());
  });

  it("brings back a piece the draft no longer has, in the place its own saved order puts it", () => {
    const from = qpSnapshotFile();
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: from,
      currentFile: qpCurrentFile(),
      entryId: 7,
      now: NOW,
    });

    // Entry 7 is the one a later save deleted, and `upsertQuintuplapusEditorValue` drops every entry it does
    // not already hold in the draft. Where the version's copy lands is decided by its own saved `order`
    // (15, between 10 and 20), which is where an ordinary save would have put the same piece.
    expect(qpPieces(result).map((item) => item.id)).toEqual([1, 7, 2, 3]);
    expect(qpPieceById(result, 7)).toEqual(qpPieceById(from, 7));
  });

  it("restores one entry and not the rest of the version it came from", () => {
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: qpSnapshotFile(),
      currentFile: qpCurrentFile(),
      entryId: 2,
      now: NOW,
    });

    expect(qpPieces(result).map((item) => item.id)).toEqual([1, 2, 3]);
    expect(qpPieceById(result, 2)).toEqual(qpPieceById(qpSnapshotFile(), 2));
    expect(qpPieceById(result, 1)?.attributes.description).toBe("one");
  });

  it("leaves every other entry exactly as the current draft held it", () => {
    const held = qpCurrentFile();
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: qpSnapshotFile(),
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    for (const id of [2, 3]) {
      expect(JSON.stringify(qpPieceById(result, id))).toBe(
        JSON.stringify(qpPieceById(held, id)),
      );
    }
  });

  it("keeps the version's own dates on the piece it restores, and stamps only the file", () => {
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: qpSnapshotFile(),
      currentFile: qpCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    expect(qpPieceById(result, 1)?.attributes.updatedAt).toBe(
      "2022-06-06T00:00:00.000Z",
    );
    expect(qpPieceById(result, 1)?.attributes.createdAt).toBe(
      "2022-02-01T00:00:00.000Z",
    );

    // The editor's own upsert re-stamps `updatedAt` on every piece it writes, which is what a save does to
    // the piece it saved. An untouched piece has to arrive untouched.
    expect(qpPieceById(result, 2)?.attributes.updatedAt).toBe(
      "2024-01-02T00:00:00.000Z",
    );
    expect(qpPieceById(result, 3)?.attributes.updatedAt).toBe(
      "2024-01-03T00:00:00.000Z",
    );

    expect(result.timestamp).toBe(NOW.getTime());
  });

  it("carries the version's own artwork, title, date, medium and image included", () => {
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: qpSnapshotFile(),
      currentFile: qpCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    const piece = qpPieceById(result, 1);

    // The three fields the editor has inputs for are the easy half. Whether a piece had an image at all, and
    // what that image was, is only knowable from the version, and the editor's own form carries a url and
    // nothing else.
    expect(piece?.attributes.medium).toBe("gouache");
    expect(piece?.attributes.createdDate).toBe("2019-05-05");
    expect(piece?.attributes.image.data?.attributes.url).toBe(
      "/media/old-piece",
    );
  });

  it("leaves the category's own attributes exactly as the draft held them", () => {
    const held = qpCurrentFile();
    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: qpSnapshotFile(),
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    // One art category holds every piece, and the reused upsert re-stamps it and re-writes its title from
    // the editor's projection. Restoring one piece must not read to the next save as a renamed category.
    // Neither the version's category (2020) nor a category the reused upsert re-stamped with today (2026).
    expect(qpCategory(result)?.title).toBe("Draft category title");
    expect(qpCategory(result)?.createdAt).toBe("2022-01-01T00:00:00.000Z");
    expect(qpCategory(result)?.updatedAt).toBe("2022-01-01T00:00:00.000Z");
  });

  it("inherits the editor's own `omit` behaviour, which is the behaviour a save already has", () => {
    const current = qpCurrentFile({
      omit: { data: [{ id: 2, attributes: null }] },
    });

    const result = restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: qpSnapshotFile(),
      currentFile: current,
      entryId: 1,
      now: NOW,
    });

    // `toQuintuplapusEditorValue` drops every piece the category's `omit` list names, and the upsert writes
    // `art_pieces` from the editor's list alone, so a save already removes those pieces from a draft before
    // any restore is reached. A restore that kept piece 2 would be doing something no save of this file
    // does, and the difference would be invisible until the next save dropped it again.
    expect(qpPieces(result).map((item) => item.id)).toEqual([1, 3]);
    expect(qpCategory(result)?.omit).toEqual({
      data: [{ id: 2, attributes: null }],
    });
  });

  it("says no, out loud, when that version never held the entry", () => {
    expect(() =>
      restoreQuintuplapusEntryFromSnapshot({
        snapshotFile: qpSnapshotFile(),
        currentFile: qpCurrentFile(),
        entryId: 42,
        now: NOW,
      }),
    ).toThrow(/holds no Quintuplapus entry 42 to restore/);
  });

  it("refuses a saved copy it cannot trust an id from, instead of inventing or renaming one", () => {
    const poisoned = {
      ...qpSnapshotFile(),
      data: {
        ...qpSnapshotFile().data,
        data: [
          {
            ...qpSnapshotFile().data.data[0],
            attributes: {
              ...qpSnapshotFile().data.data[0].attributes,
              art_pieces: {
                ...qpSnapshotFile().data.data[0].attributes.art_pieces,
                data: qpPieces(qpSnapshotFile()).map((item) =>
                  item.id === 1 ? { ...item, id: 0 } : item,
                ),
              },
            },
          },
        ],
      },
    };

    expect(() =>
      restoreQuintuplapusEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: qpCurrentFile(),
        entryId: 0,
        now: NOW,
      }),
    ).toThrow(/no id this restore can trust/);

    // A copy with a broken id is never renamed into an id the editor asked for: `id: 0` is refused out loud,
    // and the entry the editor actually named is refused because the version genuinely no longer holds it.
    expect(() =>
      restoreQuintuplapusEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: qpCurrentFile(),
        entryId: 1,
        now: NOW,
      }),
    ).toThrow(/holds no Quintuplapus entry 1 to restore/);
  });

  it("hands back a new file and leaves the two files it was given as it found them", () => {
    const held = qpCurrentFile();
    const from = qpSnapshotFile();
    const heldBefore = JSON.stringify(held);
    const fromBefore = JSON.stringify(from);

    restoreQuintuplapusEntryFromSnapshot({
      snapshotFile: from,
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    expect(JSON.stringify(held)).toBe(heldBefore);
    expect(JSON.stringify(from)).toBe(fromBefore);
  });
});

// ---------------------------------------------------- the rules, asked of souljuicer

describe("restoring one SoulJuicer entry out of a saved version", () => {
  it("replaces the restored page with the version's own copy of it", () => {
    const from = sjSnapshotFile();
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: from,
      currentFile: sjCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    expect(sjEntryById(result, 1)).toEqual(sjEntryById(from, 1));
    expect(result.timestamp).toBe(NOW.getTime());
  });

  it("brings back a page the draft no longer has, in the place its own saved order puts it", () => {
    const from = sjSnapshotFile();
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: from,
      currentFile: sjCurrentFile(),
      entryId: 7,
      now: NOW,
    });

    expect(sjEntries(result).map((item) => item.id)).toEqual([1, 7, 2, 3]);
    expect(sjEntryById(result, 7)).toEqual(sjEntryById(from, 7));
  });

  it("restores one entry and not the rest of the version it came from", () => {
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: sjSnapshotFile(),
      currentFile: sjCurrentFile(),
      entryId: 2,
      now: NOW,
    });

    expect(sjEntries(result).map((item) => item.id)).toEqual([1, 2, 3]);
    expect(sjEntryById(result, 2)).toEqual(sjEntryById(sjSnapshotFile(), 2));
    expect(sjEntryById(result, 1)?.attributes.description).toBe("one");
  });

  it("leaves every other entry exactly as the current draft held it", () => {
    const held = sjCurrentFile();
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: sjSnapshotFile(),
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    for (const id of [2, 3]) {
      expect(JSON.stringify(sjEntryById(result, id))).toBe(
        JSON.stringify(sjEntryById(held, id)),
      );
    }
  });

  it("keeps the version's own dates on the page it restores, and stamps only the file", () => {
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: sjSnapshotFile(),
      currentFile: sjCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    expect(sjEntryById(result, 1)?.attributes.updatedAt).toBe(
      "2022-06-06T00:00:00.000Z",
    );
    expect(sjEntryById(result, 1)?.attributes.createdAt).toBe(
      "2022-02-01T00:00:00.000Z",
    );
    expect(sjEntryById(result, 2)?.attributes.updatedAt).toBe(
      "2024-01-02T00:00:00.000Z",
    );
    expect(sjEntryById(result, 3)?.attributes.updatedAt).toBe(
      "2024-01-03T00:00:00.000Z",
    );

    expect(result.timestamp).toBe(NOW.getTime());
  });

  it("carries the version's own page, image and fields the editor has no input for", () => {
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: sjSnapshotFile(),
      currentFile: sjCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    expect(sjEntryById(result, 1)?.attributes.medium).toBe("gouache");
    expect(sjEntryById(result, 1)?.attributes.image.data?.attributes.url).toBe(
      "/media/old-page",
    );
  });

  it("re-counts the list instead of reporting an entry the draft does not hold", () => {
    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: sjSnapshotFile(),
      currentFile: sjCurrentFile(),
      entryId: 7,
      now: NOW,
    });

    // This resource's pagination is derived by the upsert from the list it managed to write, and that list is
    // one entry short whenever the restored entry is one the draft had dropped. The entry written out of the
    // version here is the difference, and the count has to catch up with it.
    expect(result.data.meta.pagination.total).toBe(4);
    expect(result.data.meta.pagination.pageCount).toBe(1);
    expect(result.data.meta.pagination.pageSize).toBe(25);
  });

  it("writes no title into an entry the version held no title for", () => {
    const untitled = sjFile(700, [
      ...sjSnapshotFile().data.data.map((item) =>
        item.id === 1
          ? { ...item, attributes: { ...item.attributes, title: undefined } }
          : item,
      ),
    ]);

    const result = restoreSouljuicerEntryFromSnapshot({
      snapshotFile: untitled,
      currentFile: sjCurrentFile(),
      entryId: 1,
      now: NOW,
    });

    // `toSouljuicerEditorValue` hands the editor a default title for an entry that has none, and the upsert
    // writes that default back into the entry. A restore works from the version's own copy, and a version
    // that held no title for an entry is no licence to invent one: the entry the next editor sees is the
    // entry that version held.
    expect(sjEntryById(result, 1)?.attributes.title).toBeUndefined();
  });

  it("says no, out loud, when that version never held the entry", () => {
    expect(() =>
      restoreSouljuicerEntryFromSnapshot({
        snapshotFile: sjSnapshotFile(),
        currentFile: sjCurrentFile(),
        entryId: 42,
        now: NOW,
      }),
    ).toThrow(/holds no SoulJuicer entry 42 to restore/);
  });

  it("refuses a saved copy it cannot trust an id from, instead of inventing or renaming one", () => {
    const poisoned = sjFile(
      700,
      sjSnapshotFile().data.data.map((item) =>
        item.id === 1 ? { ...item, id: 0 } : item,
      ),
    );

    expect(() =>
      restoreSouljuicerEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: sjCurrentFile(),
        entryId: 0,
        now: NOW,
      }),
    ).toThrow(/no id this restore can trust/);

    expect(() =>
      restoreSouljuicerEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: sjCurrentFile(),
        entryId: 1,
        now: NOW,
      }),
    ).toThrow(/holds no SoulJuicer entry 1 to restore/);
  });

  it("hands back a new file and leaves the two files it was given as it found them", () => {
    const held = sjCurrentFile();
    const from = sjSnapshotFile();
    const heldBefore = JSON.stringify(held);
    const fromBefore = JSON.stringify(from);

    restoreSouljuicerEntryFromSnapshot({
      snapshotFile: from,
      currentFile: held,
      entryId: 1,
      now: NOW,
    });

    expect(JSON.stringify(held)).toBe(heldBefore);
    expect(JSON.stringify(from)).toBe(fromBefore);
  });
});
// ------------------------------------------------------- the fake store, and the wiring

type FakeState = {
  draftText: Record<string, string | undefined>;
  snapshotText: Record<string, string | undefined>;
  history: Record<string, HistoryEntry[]>;
  snapshotFailure?: Record<string, Error>;
  calls: string[];
  writes: Array<{ name: string; scope: string; file: unknown }>;
  /** The `limit` each history listing was asked for, recorded so a picker's own bound is observable. */
  historyLimits: Array<number | undefined>;
};

const draftText = (): Record<string, string | undefined> => ({
  "web-experience": JSON.stringify(wxCurrentFile()),
  "the-quintuplapus": JSON.stringify(qpCurrentFile()),
  "the-souljuicer": JSON.stringify(sjCurrentFile()),
});

const snapshotText = (): Record<string, string | undefined> => ({
  "web-experience": JSON.stringify(wxSnapshotFile()),
  "the-quintuplapus": JSON.stringify(qpSnapshotFile()),
  "the-souljuicer": JSON.stringify(sjSnapshotFile()),
});

const history = (): Record<string, HistoryEntry[]> => ({
  "web-experience": [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
  "the-quintuplapus": [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
  "the-souljuicer": [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
});

/**
 * One fake store for all three resources, with its calls recorded in order.
 *
 * The ordering rule the card cares about — a copy of the current draft exists *before* the new draft replaces
 * it, and the tier a restore reads is never the tier it writes — is not observable from a returned file, and
 * a disk or a bucket is not something a test may run. Recording the calls a fake was actually asked to make
 * is what makes both halves testable.
 */
const makeFakeStore = (state: FakeState): DataStore => ({
  readFile: async (name, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`readFile:${name}:${scoped}`);

    const text = state.draftText[name];

    if (text === undefined) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }

    return text;
  },
  writeFile: async (name, file, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`writeFile:${name}:${scoped}`);
    state.writes.push({
      name,
      scope: scoped,
      file: JSON.parse(JSON.stringify(file)) as unknown,
    });
    state.draftText[name] = JSON.stringify(file);
  },
  ensureBaselineSnapshot: async (name, scope) => {
    state.calls.push(`baseline:${name}:${scope ?? "draft"}`);

    return state.draftText[name] !== undefined;
  },
  release: async (name) => {
    state.calls.push(`release:${name}`);

    return 1;
  },
  listHistory: async (name, options) => {
    state.calls.push(`listHistory:${name}:${options?.scope ?? "all"}`);
    state.historyLimits.push(options?.limit);

    return state.history[name] ?? [];
  },
  readHistory: async (name, timestamp, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`readHistory:${name}:${timestamp}:${scoped}`);

    const failure = state.snapshotFailure?.[name];

    if (failure) throw failure;

    const text = state.snapshotText[name];

    if (text === undefined) {
      throw new MissingSnapshotError(name, timestamp, scoped);
    }

    return text;
  },
});

// The state is one object, mutated in place: every resource module builds its store once at module-load time
// out of the mocked `contentDataStore`, and a fake whose calls are recorded on an object that outlives that
// load is what a test can then read.
const state: FakeState = {
  draftText: draftText(),
  snapshotText: snapshotText(),
  history: history(),
  calls: [],
  writes: [],
  historyLimits: [],
};

const resetState = () => {
  state.draftText = draftText();
  state.snapshotText = snapshotText();
  state.history = history();
  state.snapshotFailure = undefined;
  state.calls.length = 0;
  state.writes.length = 0;
  state.historyLimits.length = 0;
};

vi.mock("#lib/s3", () => ({
  initS3: vi.fn(),
  getS3Client: vi.fn(),
  getOptionalS3Bucket: vi.fn(() => undefined),
  getS3File: vi.fn(),
  uploadS3File: vi.fn(),
  deleteS3File: vi.fn(),
  s3BodyToString: vi.fn(),
}));

// Each resource module builds its store at module-load time out of `contentDataStore()`, so replacing that one
// function — with the real module still in place under it — is what lets these tests check the wiring without
// a bucket or a disk. Every key shares one double, and the content-key name each call records is what tells
// them apart.
vi.mock("#lib/content.server", async () => {
  const actual = await vi.importActual<typeof import("#lib/content.server")>(
    "#lib/content.server",
  );

  return {
    ...actual,
    contentDataStore: () => makeFakeStore(state),
  };
});

type RestoreParams = {
  scope: "draft" | "live" | "legacy";
  timestamp: number;
  entryId: number;
  now?: Date;
};

/** One entry a saved version held, as far as these tests need to read it: an id, a name, a position. */
type SnapshotEntry = {
  readonly id: number;
  readonly title: string;
  readonly sortOrder: number;
};

type ResourceWiring = {
  key: string;
  label: string;
  noun: string;
  entryIds: (file: unknown) => number[];
  updatedAtOf: (file: unknown, id: number) => string | undefined;
  snapshotTitles: string[];
  listVersions: () => Promise<Array<{ timestamp: number; scope: string }>>;
  /**
   * What a snapshot's entries look like through the resource modules that read them: `ReadonlyArray`, because
   * each module hands back Effect's decoded value, whose every level is readonly, and `sortOrder`, because a
   * picker has to be able to say where each entry sat without reaching into the resource's own entry shape.
   */
  readSnapshotEntries: (
    scope: "draft" | "live" | "legacy",
    timestamp: number,
  ) => Promise<ReadonlyArray<SnapshotEntry>>;
  restore: (params: RestoreParams) => Promise<unknown>;
  /** Where this resource's editor page sits, and which `params` key names the entry being edited. */
  editorPath: string;
  paramKey: string;
  /** The entry these tests restore, in the page named by `editorPath`. */
  entryId: number;
  /** The link a successful restore sends the editor to, built by this resource's own path builder. */
  heldPath: string;
  importPage: () => Promise<unknown>;
};

/**
 * The three server modules are loaded with a dynamic import rather than a static one on purpose: each one
 * builds its store the moment it loads, and the mocked `contentDataStore` has to be in place before that
 * happens — not during the import of this file.
 */
type ServerModules = {
  webExperience: typeof import("#lib/editing/resources/web-experience/web-experience.server");
  quintuplapus: typeof import("#lib/editing/resources/quintuplapus/quintuplapus.server");
  souljuicer: typeof import("#lib/editing/resources/souljuicer/souljuicer.server");
};

let servers: ServerModules;

const loadServers = async (): Promise<ServerModules> => ({
  webExperience:
    await import("#lib/editing/resources/web-experience/web-experience.server"),
  quintuplapus:
    await import("#lib/editing/resources/quintuplapus/quintuplapus.server"),
  souljuicer:
    await import("#lib/editing/resources/souljuicer/souljuicer.server"),
});

const resources: ResourceWiring[] = [
  {
    key: "web-experience",
    label: "web experience",
    noun: "rich link",
    entryIds: (file) => wxLinks(file as WxFile).map((item) => item.id),
    updatedAtOf: (file, id) =>
      wxLinkById(file as WxFile, id)?.attributes.updatedAt,
    snapshotTitles: [
      "Experience one as it was",
      "Experience seven, deleted since",
      "Experience two as it was",
    ],
    listVersions: () =>
      servers.webExperience.listWebExperienceEditorHistoryVersions(),
    readSnapshotEntries: (scope, timestamp) =>
      servers.webExperience.readWebExperienceEditorSnapshotEntries(
        scope,
        timestamp,
      ),
    restore: (params) =>
      servers.webExperience.restoreWebExperienceEditorEntryFromSnapshot(params),
    editorPath: "/web-experience/edit/1",
    paramKey: "wid",
    entryId: 1,
    heldPath: webExperienceEditorPath(
      { kind: "entry", id: 1 },
      "Experience one as it was",
    ),
    importPage: () =>
      import("../../src/routes/web-experience/edit/[...wid]/+page.server"),
  },
  {
    key: "the-quintuplapus",
    label: "Quintuplapus",
    noun: "art piece",
    entryIds: (file) => qpPieces(file as QpFile).map((item) => item.id),
    updatedAtOf: (file, id) =>
      qpPieceById(file as QpFile, id)?.attributes.updatedAt,
    snapshotTitles: [
      "Piece one as it was",
      "Piece seven, deleted since",
      "Piece two as it was",
    ],
    listVersions: () =>
      servers.quintuplapus.listQuintuplapusEditorHistoryVersions(),
    readSnapshotEntries: (scope, timestamp) =>
      servers.quintuplapus.readQuintuplapusEditorSnapshotEntries(
        scope,
        timestamp,
      ),
    restore: (params) =>
      servers.quintuplapus.restoreQuintuplapusEditorEntryFromSnapshot(params),
    editorPath: "/the-quintuplapus/edit/1",
    paramKey: "aid",
    entryId: 1,
    heldPath: quintuplapusEditorPath(1, "Piece one as it was"),
    importPage: () =>
      import("../../src/routes/the-quintuplapus/edit/[...aid]/+page.server"),
  },
  {
    key: "the-souljuicer",
    label: "SoulJuicer",
    noun: "page",
    entryIds: (file) => sjEntries(file as SjFile).map((item) => item.id),
    updatedAtOf: (file, id) =>
      sjEntryById(file as SjFile, id)?.attributes.updatedAt,
    snapshotTitles: [
      "Page one as it was",
      "Page seven, deleted since",
      "Page two as it was",
    ],
    listVersions: () =>
      servers.souljuicer.listSouljuicerEditorHistoryVersions(),
    readSnapshotEntries: (scope, timestamp) =>
      servers.souljuicer.readSouljuicerEditorSnapshotEntries(scope, timestamp),
    restore: (params) =>
      servers.souljuicer.restoreSouljuicerEditorEntryFromSnapshot(params),
    editorPath: "/the-souljuicer/edit/1",
    paramKey: "aid",
    entryId: 1,
    heldPath: souljuicerEditorPath(1),
    importPage: () =>
      import("../../src/routes/the-souljuicer/edit/[...aid]/+page.server"),
  },
];

const settled = async (run: () => Promise<unknown>) =>
  await run().then(
    () => undefined,
    (cause: unknown) => cause,
  );

const messageOf = (cause: unknown) =>
  String((cause as Error)?.message ?? cause);

describe("restoring one saved entry through each resource's own wiring", () => {
  beforeAll(async () => {
    servers = await loadServers();
  });

  resources.forEach((resource) => {
    describe(`the ${resource.key} wiring`, () => {
      beforeEach(() => {
        resetState();
      });

      it(`lists the versions a restore screen offers, with the legacy tier visible`, async () => {
        const versions = await resource.listVersions();

        expect(versions).toEqual([
          { timestamp: 1000, scope: "draft" },
          { timestamp: 900, scope: "live" },
          { timestamp: 700, scope: "legacy" },
        ]);
        // `"all"` is what makes the legacy tier visible at all, and the tier each entry names is the tier a
        // later read of it has to be told, because a history read defaults to the draft tier.
        expect(state.calls).toEqual([`listHistory:${resource.key}:all`]);
      });

      it(`reads one saved version's ${resource.noun}s in the editor's own entry shape`, async () => {
        const entries = await resource.readSnapshotEntries("legacy", 700);

        expect(entries.map((entry) => entry.id)).toEqual([1, 7, 2]);
        expect(entries.map((entry) => entry.title)).toEqual(
          resource.snapshotTitles,
        );
        expect(entries.map((entry) => entry.sortOrder)).toEqual([10, 15, 20]);
        // The picker has to be given the entry ids and positions a snapshot held, in the same shape the
        // editor already knows how to render, and the legacy scope has to be passed explicitly.
        expect(state.calls).toEqual([`readHistory:${resource.key}:700:legacy`]);
      });

      it(`restores one ${resource.noun} into the draft and leaves the other entries alone`, async () => {
        await resource.restore({
          scope: "legacy",
          timestamp: 700,
          entryId: 1,
          now: NOW,
        });

        expect(state.calls).toEqual([
          `readFile:${resource.key}:draft`,
          `readHistory:${resource.key}:700:legacy`,
          `baseline:${resource.key}:draft`,
          `writeFile:${resource.key}:draft`,
        ]);

        const written = state.writes[0]?.file as unknown;

        expect(resource.entryIds(written)).toEqual([1, 2, 3]);
        // The seam stamps the file with the moment the restore happened, and hands the entry the dates the
        // version held: a restored entry stamped today is read as an entry written today.
        expect(resource.updatedAtOf(written, 1)).toBe(
          "2022-06-06T00:00:00.000Z",
        );
        expect(resource.updatedAtOf(written, 2)).toBe(
          "2024-01-02T00:00:00.000Z",
        );
        expect(resource.updatedAtOf(written, 3)).toBe(
          "2024-01-03T00:00:00.000Z",
        );
      });

      it(`refuses a version that never held the entry without writing anything`, async () => {
        const cause = await settled(() =>
          resource.restore({
            scope: "legacy",
            timestamp: 700,
            entryId: 42,
            now: NOW,
          }),
        );

        expect(messageOf(cause)).toMatch(/entry 42 to restore/);
        // A miss is a refusal, and a refusal is not a write: the seam files its baseline only once there is a
        // restored draft to file it for, so the current draft stays exactly as it was.
        expect(
          state.calls.filter((call) => call.startsWith("writeFile")),
        ).toEqual([]);
        expect(state.writes).toEqual([]);
      });

      it(`refuses a version that is not in the history as a missing version, not as an outage`, async () => {
        state.snapshotText[resource.key] = undefined;

        const cause = await settled(() =>
          resource.restore({
            scope: "legacy",
            timestamp: 700,
            entryId: 1,
            now: NOW,
          }),
        );

        // `MissingSnapshotError` is dressed into the same refusal a page sees for bad content, which is what
        // lets the route tell "that version is gone" apart from "the bucket is unreachable" and show one note
        // instead of the other.
        expect(messageOf(cause)).toMatch(/700/);
        expect(messageOf(cause)).toMatch(/is not held in legacy history/);
        expect(cause).not.toBeInstanceOf(MissingSnapshotError);
        expect(state.writes).toEqual([]);
      });

      it(`refuses a restore into a key that has no draft, without writing one`, async () => {
        state.draftText[resource.key] = undefined;

        const cause = await settled(() =>
          resource.restore({
            scope: "legacy",
            timestamp: 700,
            entryId: 1,
            now: NOW,
          }),
        );

        // A per-entry entry restores *into* a draft. A draft assembled out of one entry from nowhere would be
        // a whole-record replacement wearing the words "one entry", so this refuses before it even reads the
        // version it was asked for.
        expect(messageOf(cause)).toBe("ENOENT");
        expect(state.calls).toEqual([`readFile:${resource.key}:draft`]);
        expect(state.writes).toEqual([]);
      });

      it("reads the tier it was asked for and writes only the draft", async () => {
        await resource.restore({
          scope: "live",
          timestamp: 900,
          entryId: 2,
          now: NOW,
        });

        expect(state.calls).toEqual([
          `readFile:${resource.key}:draft`,
          `readHistory:${resource.key}:900:live`,
          `baseline:${resource.key}:draft`,
          `writeFile:${resource.key}:draft`,
        ]);
        // Restoring out of a published version does not touch that version, and it does not push the draft
        // into it either: publishing is the next card's job, and this card's rule is that a restore never
        // writes live.
        expect(
          state.calls.filter(
            (call) =>
              call.startsWith("writeFile") || call.startsWith("release"),
          ),
        ).toEqual([`writeFile:${resource.key}:draft`]);
      });

      it("hands a store outage up as itself rather than as a version that is not there", async () => {
        state.snapshotFailure = {
          [resource.key]: new Error("bucket unreachable"),
        };

        const cause = await settled(() =>
          resource.restore({
            scope: "legacy",
            timestamp: 700,
            entryId: 1,
            now: NOW,
          }),
        );

        // "That version is gone" is not a conclusion an unreachable bucket supports, and the seam keeps the
        // two tellable apart for every resource that plugs into it. What each resource finally tells the
        // editor is the route's log rule, decided in the route tests.
        expect(cause).toBeInstanceOf(Error);
        expect(messageOf(cause)).toBe("bucket unreachable");
        expect(cause).not.toBeInstanceOf(MissingSnapshotError);
        expect(state.writes).toEqual([]);
      });
    });
  });
});
// ---------------------------------------------------- the three editor routes' restore screens

/**
 * The flow the card is about, in the pages that actually show it: the version list, then one entry out of that
 * version, then the confirmation, then the line the page shows afterwards.
 *
 * The seams under these pages are the real ones - only the store under them is faked - because what has to be
 * proven here is what each of the three pages *does* with a refusal: which link it sends the editor to, whether
 * it asked the store for anything before refusing, and which of its two notes a version it could not read gets.
 */
vi.mock("#lib/editing/core/session.server", () => ({
  // Editor auth is mocked wholesale here, exactly as every route suite in `test/routes/` mocks it: the gate is
  // covered by test/lib/editor-auth.test.ts rather than repeated in every page.
  requireEditorAccess: vi.fn(),
  isEditorUnlockedForRequest: vi.fn(() => true),
}));

vi.mock("@sveltejs/kit", async () => {
  const actual =
    await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");

  return {
    ...actual,
    // A SvelteKit redirect is a thrown value. Keeping it a plain object is what lets a test read the link an
    // action chose instead of catching the framework's own branded instance - and `error`, `fail` and
    // `isHttpError` stay the real ones, which is what a refusal's two shapes are told apart with.
    redirect: (status: number, location: string) => ({ status, location }),
  };
});

type RestorePanelData = {
  open: boolean;
  note: string | null;
  target: {
    entries: Array<{ id: number; title: string; willReplace: boolean }>;
  } | null;
  versions: Array<{
    timestamp: number;
    scope: string;
    dateLabel: string;
    tierLabel: string;
    href: string;
  }>;
};

type EditorPageData = {
  savedTitle: string | null;
  savedMessage: string | null;
  restore: RestorePanelData;
};

const READ_NOTE =
  "That version could not be read. Pick a version from the list below - nothing has been written to your draft.";

const NAME_NOTE =
  "A version to restore must be named by a timestamp and one of draft, live or legacy. Pick a version from the list below.";

const REFUSAL_MESSAGE =
  "Nothing was restored: that version could not be read, or no longer holds that entry. Your current draft is unchanged.";

describe("restoring one saved entry out of a version in each editor route", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  const editorUrl = (resource: ResourceWiring, search = "") =>
    new URL(`http://localhost${resource.editorPath}${search}`);

  const openPage = async (resource: ResourceWiring, search: string) => {
    const page = (await resource.importPage()) as {
      load: (input: never) => Promise<unknown>;
    };

    return loadResult(
      await page.load({
        cookies: fakeCookies(),
        params: { [resource.paramKey]: String(resource.entryId) },
        url: editorUrl(resource, search),
      } as never),
    ) as unknown as EditorPageData;
  };

  const confirmRestore = async (
    resource: ResourceWiring,
    fields: Record<string, string> = {},
  ) => {
    const page = (await resource.importPage()) as {
      actions: Record<string, (input: never) => Promise<unknown>>;
    };
    const formData = new FormData();

    Object.entries({
      scope: "legacy",
      timestamp: "700",
      entryId: String(resource.entryId),
      draftVersion: "1000",
      ...fields,
    }).forEach(([name, value]) => formData.set(name, value));

    return (await settled(() =>
      page.actions.restore({
        cookies: fakeCookies(),
        request: { formData: async () => formData },
        url: editorUrl(resource),
      } as never),
    )) as { status: number; location: string };
  };

  /** The query a successful restore put on its own redirect link, read back out of that link. */
  const searchOf = (resource: ResourceWiring, location: string) =>
    location.slice(resource.editorPath.length);

  beforeEach(() => {
    resetState();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  resources.forEach((resource) => {
    describe(`${resource.key}: ${resource.noun}s through the version list, the confirmation and the line afterwards`, () => {
      it("restores one entry into the draft and sends the editor to it named by version and tier", async () => {
        const refusal = await confirmRestore(resource);

        expect(refusal.status).toBe(303);
        // The editor lands on the entry it restored, in a link that names the version, the entry and the tier -
        // which is what the page's next line is built out of.
        expect(refusal.location).toBe(
          `${resource.heldPath}?restored=700&entry=${resource.entryId}&scope=legacy`,
        );

        expect(state.calls).toEqual([
          `readFile:${resource.key}:draft`,
          `readHistory:${resource.key}:700:legacy`,
          `baseline:${resource.key}:draft`,
          `writeFile:${resource.key}:draft`,
        ]);
        // Every tier this page touched during a restore is a tier it read from, and the only tier it wrote is
        // the draft it protected first. Publishing that draft is the next card's decision, not this page's.
        expect(state.writes.map((write) => write.scope)).toEqual(["draft"]);

        const written = state.writes[0]?.file as { timestamp: number };

        // The restored draft carries the moment the restore happened - not the version's timestamp, and not the
        // draft's own - because it is the copy a later save files as the thing a restore undid.
        expect(written.timestamp).toBeGreaterThan(
          new Date("2026-01-01T00:00:00.000Z").getTime(),
        );
      });

      it("names the entry that came back and the version it came out of, in the line the page shows next", async () => {
        const refusal = await confirmRestore(resource);
        const page = await openPage(
          resource,
          searchOf(resource, refusal.location),
        );

        expect(page.savedTitle).toBe("Restore complete");
        // The entry is named by the title the restored draft holds it with, which is the version's own - so the
        // line names what the editor can now see in the form, not what the form held before.
        expect(page.savedMessage).toBe(
          `Restored "${resource.snapshotTitles[0]}" from the version saved 1 January 1970 at 00:00 (pre-S3 copy).`,
        );
      });

      it("refuses out loud when a restore failed, without naming an entry it did not restore", async () => {
        const page = await openPage(resource, "?restore-failed=1");

        expect(page.savedTitle).toBe("Nothing restored");
        expect(page.savedMessage).toBe(REFUSAL_MESSAGE);
        expect(page.restore.open).toBe(false);

        // A hand-edited `?restored` link says nothing at all rather than claiming nothing happened: this page
        // cannot tell a restore that just worked from an old link somebody pasted again.
        const guessed = await openPage(
          resource,
          "?restored=maybe&entry=1&scope=legacy",
        );

        expect(guessed.savedTitle).toBeNull();
        expect(guessed.savedMessage).toBeNull();
      });

      it.each([
        {
          label: "a tier it was never allowed to name",
          fields: { scope: "published" },
        },
        {
          label: "a version number that is not a whole number",
          fields: { timestamp: "not-a-number" },
        },
        {
          label: "the entry id zero",
          fields: { entryId: "0" },
        },
        {
          label: "a version number with a decimal point in it",
          fields: { timestamp: "700.5" },
        },
        {
          label: "an entry id that is a negative number",
          fields: { entryId: "-1" },
        },
      ])(
        "refuses a confirmation form holding $label before asking the store for anything",
        async ({ fields }) => {
          const refusal = await confirmRestore(resource, fields);

          expect(refusal.status).toBe(303);
          expect(refusal.location).toBe(
            `${resource.editorPath}?restore-failed=1`,
          );
          // Refused before the store is asked anything at all: `?restore-failed=1` is the only shape a refusal
          // is routed in, so the line the editor is shown never depends on a message this page would have to
          // guess at - and a `0` is refused out loud rather than renamed into something a seam would swallow.
          expect(state.calls).toEqual([]);
          expect(state.writes).toEqual([]);
        },
      );

      it("writes nothing when the version it was sent is not held in the tier it was named in, and keeps that refusal out of the log", async () => {
        state.snapshotText[resource.key] = undefined;

        const refusal = await confirmRestore(resource);

        expect(refusal.location).toBe(
          `${resource.editorPath}?restore-failed=1`,
        );
        expect(state.writes).toEqual([]);
        expect(state.calls).toEqual([
          `readFile:${resource.key}:draft`,
          `readHistory:${resource.key}:700:legacy`,
        ]);
        // The seam dresses a version it cannot find into an HTTP error, which is what lets this page keep a
        // dressed refusal out of the log while it still writes an outage to it.
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("writes nothing when the store is not answering, and refuses to call an outage a missing version", async () => {
        state.snapshotFailure = {
          [resource.key]: new Error("bucket unreachable"),
        };

        const refusal = await confirmRestore(resource);

        expect(refusal.location).toBe(
          `${resource.editorPath}?restore-failed=1`,
        );
        expect(state.writes).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[1]).toBeInstanceOf(Error);
      });

      it("offers the versions it can reach, five at most, each link sending the tier it was found in", async () => {
        state.history[resource.key] = [
          { timestamp: 5000, scope: "draft" },
          { timestamp: 4000, scope: "live" },
          { timestamp: 3000, scope: "legacy" },
          { timestamp: 2000, scope: "draft" },
          { timestamp: 1500, scope: "live" },
          { timestamp: 1000, scope: "legacy" },
        ];

        const page = await openPage(resource, "?restore=1");

        expect(page.restore.open).toBe(true);
        // Five is what a restore screen can render, and it is asked for by number rather than left to the
        // store's own default of a whole history listing.
        expect(state.historyLimits).toEqual([5]);
        expect(
          page.restore.versions.map((version) => version.timestamp),
        ).toEqual([5000, 4000, 3000, 2000, 1500]);
        expect(
          page.restore.versions.map((version) => version.tierLabel),
        ).toEqual([
          "(draft)",
          "(published version)",
          "(pre-S3 copy)",
          "(draft)",
          "(published version)",
        ]);
        // Each version's own link carries the tier it was found in, because a legacy version read with the
        // store's default tier is a miss.
        expect(page.restore.versions[2]?.href).toBe(
          `${resource.editorPath}?restore=1&restoreVersion=3000&restoreScope=legacy`,
        );
      });

      it("opens on a bare ?restore and on ?restore=1 alike, and never hands the sentinel's value to the store as a version number", async () => {
        const bare = await openPage(resource, "?restore");
        const valued = await openPage(resource, "?restore=1700000000000");

        expect(bare.restore.open).toBe(true);
        expect(bare.restore.target).toBeNull();
        expect(valued.restore.open).toBe(true);
        expect(valued.restore.target).toBeNull();
        // The value of `?restore` says which control opened the dialog, not which version to read. Reading it as
        // a timestamp is how a version from November 2023 would arrive at the store unasked.
        expect(
          state.calls.filter((call) => call.startsWith("readHistory")),
        ).toEqual([]);
        expect(state.historyLimits).toEqual([5, 5]);
      });

      it("says which version it could not read, instead of showing an empty list of entries or a raw outage", async () => {
        state.snapshotText[resource.key] = undefined;

        const missing = await openPage(
          resource,
          "?restore=1&restoreVersion=700&restoreScope=legacy",
        );

        expect(missing.restore.target).toBeNull();
        expect(missing.restore.note).toBe(READ_NOTE);
        // The versions that *can* be read are still offered, so the note is an explanation and not a wall.
        expect(
          missing.restore.versions.map((version) => version.timestamp),
        ).toEqual([1000, 900, 700]);
        expect(consoleError).not.toHaveBeenCalled();

        state.snapshotFailure = {
          [resource.key]: new Error("bucket unreachable"),
        };

        const outage = await openPage(
          resource,
          "?restore=1&restoreVersion=700&restoreScope=legacy",
        );

        expect(outage.restore.note).toBe(READ_NOTE);
        // The note an editor is shown is the same either way, and the log is what makes the two tellable apart:
        // a refusal the seam already dressed is not written to it, an outage is.
        expect(consoleError).toHaveBeenCalledTimes(1);
      });

      it("refuses a version named by a timestamp it cannot read, before asking the store for anything", async () => {
        const page = await openPage(
          resource,
          "?restore=1&restoreVersion=0&restoreScope=maybe",
        );

        expect(page.restore.target).toBeNull();
        expect(page.restore.note).toBe(NAME_NOTE);
        // A zero is refused out loud rather than renamed, and nothing is read: the picker is still open, and the
        // versions it can reach are still listed.
        expect(state.historyLimits).toEqual([5]);
        expect(
          state.calls.filter((call) => call.startsWith("readHistory")),
        ).toEqual([]);
      });

      it("lists the entries that version held, marked by what the current draft already did to them", async () => {
        const page = await openPage(
          resource,
          "?restore=1&restoreVersion=700&restoreScope=legacy",
        );
        const target = page.restore.target;

        expect(target?.entries.map((entry) => entry.id)).toEqual([1, 7, 2]);
        expect(target?.entries.map((entry) => entry.title)).toEqual(
          resource.snapshotTitles,
        );
        // An entry the draft still holds is named as a replacement, and the entry a later save deleted is named
        // as a bring-back - which is the difference an editor is choosing between.
        expect(target?.entries.map((entry) => entry.willReplace)).toEqual([
          true,
          false,
          true,
        ]);
      });
    });
  });
});

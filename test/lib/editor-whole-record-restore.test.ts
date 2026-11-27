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

// Pure helpers only, and on purpose: the three *server* modules build their store the moment they load, and
// the mocked `contentDataStore` has to be live before that happens - not during the import of this file. The
// server modules are therefore imported dynamically further down. These three know neither a store nor a tier.
import {
  toLandingEditorValue,
  type LandingFile,
} from "#lib/editing/resources/landing/landing";
import {
  toLayoutEditorValue,
  type LayoutFile,
} from "#lib/editing/resources/layout/layout";
import {
  toTermsOfServiceEditorValue,
  type TermsOfServiceFile,
} from "#lib/editing/resources/terms-of-service/terms-of-service";

import { fakeCookies } from "../routes/fakeCookies";
import { loadResult } from "../routes/loadResult";

/**
 * Card T8 — the three keys that have no entries, restored as whole records.
 *
 * T7 rolled the per-entry rule out to the entry-list editors. `landing`, `layout` and `terms-of-service` are
 * the other shape: one record each, no entry ids in their editor values, nothing for a merge to single out.
 * They plug into the seam's other half - `restoreWholeRecord` - which reads a saved copy whole, files the copy
 * it is about to replace, and writes the whole record back as a new draft.
 *
 * So this file asks the questions that are specific to that half of the seam:
 *
 *   - Does a restore read the tier it was named by, file what it is replacing *first*, and then write exactly
 *     one tier - the draft - never live, and never a `release()`?
 *   - Does it keep working for a key that has no draft yet, instead of inventing one? `terms-of-service` has
 *     never had a draft tier, so its whole history is only good for this.
 *   - Does the record that comes back hold only what that key's own codec can name? This is the card's one
 *     real catch, and it is measured here rather than asserted: a whole-record restore *reads* the saved copy
 *     through the key's file schema, so the fields that schema does not name are gone before a write is even
 *     reached. A layout copy's whole header component tree, and a home page section's image record, do not
 *     travel back into the draft - which is why the confirmation step says "the record this editor can write"
 *     instead of promising a page exactly as it was.
 *   - And in the pages themselves: which link a refusal travels in, whether the store was asked for anything
 *     before the refusal, and what the confirmation step actually puts in front of an editor - a comparison
 *     measured out of the two records, both counts read out of the records themselves.
 *
 * No bucket and no disk is involved. The fake store records its own calls in order, which is the only way the
 * ordering rule is testable rather than documentable.
 */

const NOW = new Date("2026-03-01T00:00:00.000Z");

// ------------------------------------------------------------------------ the three records

/**
 * A landing copy as the store holds it: the envelope, the page entry, and the sections under
 * `page_details.data`. The extra fields a real copy carries - timestamps, `order`, a media record on each
 * section, a `docId` - are written here because the card's warning is about them: `landingFileC` names none of
 * them, so they are what a restore cannot bring back.
 */
type LandingSectionFixture = {
  id: number;
  title: string;
  description: string;
  link: string | null;
  image?: { id: number; url: string };
};

const landingFileFixture = ({
  timestamp,
  pageTitle,
  sections,
}: {
  timestamp: number;
  pageTitle: string;
  sections: LandingSectionFixture[];
}) => ({
  name: "landing",
  timestamp,
  data: {
    id: 1,
    meta: { pagination: { total: sections.length } },
    data: [
      {
        id: 1,
        attributes: {
          title: pageTitle,
          createdAt: "2019-01-01T00:00:00.000Z",
          updatedAt: "2019-01-01T00:00:00.000Z",
          order: "asc",
          publishedAt: null,
          page_details: {
            id: 7,
            docId: "page-details-doc",
            data: sections.map((section) => ({
              id: section.id,
              attributes: {
                title: section.title,
                description: section.description,
                link: section.link,
                image: section.image ?? null,
              },
            })),
          },
        },
      },
    ],
  },
});

/** The home page the editor is writing now: three sections, one of them held in no saved version at all. */
const landingDraftFile = () =>
  landingFileFixture({
    timestamp: 1000,
    pageTitle: "Home page, edited since",
    sections: [
      {
        id: 5,
        title: "Intro, edited since",
        description: "written since the version on offer",
        link: null,
        image: { id: 91, url: "/uploads/intro-now.png" },
      },
      {
        id: 2,
        title: "Books, edited since",
        description: "changed since the version on offer",
        link: "/books-now",
        image: { id: 92, url: "/uploads/books-now.png" },
      },
      {
        id: 9,
        title: "Rants, only in the draft",
        description: "a section no saved version holds",
        link: "/rants",
      },
    ],
  });

/**
 * The version step 2 offers: four sections, in an order the draft no longer has, one of them (id 7) a section
 * a later save deleted. Its page title is the one the success line has to name.
 */
const landingSnapshotFile = () =>
  landingFileFixture({
    timestamp: 700,
    pageTitle: "Home page as it was",
    sections: [
      {
        id: 5,
        title: "Intro as it was",
        description: "the intro this version held",
        link: null,
        image: { id: 51, url: "/uploads/intro-then.png" },
      },
      {
        id: 7,
        title: "News as it was",
        description: "a section a later save deleted",
        link: null,
        image: { id: 57, url: "/uploads/news-then.png" },
      },
      {
        id: 2,
        title: "Books as it was",
        description: "the books page this version held",
        link: "/books-then",
        image: { id: 52, url: "/uploads/books-then.png" },
      },
      {
        id: 4,
        title: "Galleries as it was",
        description: "the galleries page this version held",
        link: null,
      },
    ],
  });

/** A layout copy: the one header record, its media record, and the component tree every page renders from. */
const layoutFileFixture = ({
  timestamp,
  title,
  logoUrl,
}: {
  timestamp: number;
  title: string;
  logoUrl: string;
}) => ({
  name: "layout",
  timestamp,
  data: {
    data: [
      {
        id: 3,
        attributes: {
          title,
          description: null,
          link: null,
          createdAt: "2019-01-01T00:00:00.000Z",
          updatedAt: "2019-01-01T00:00:00.000Z",
          image: {
            data: {
              id: 9,
              attributes: {
                url: logoUrl,
                caption: title,
                alt: "alt text",
                formats: { thumbnail: { url: `${logoUrl}?w=140` } },
              },
            },
          },
          form: {
            id: 42,
            data: [
              {
                id: 43,
                attributes: { headline: "the header this version renders" },
              },
            ],
          },
        },
      },
    ],
  },
});

const layoutDraftFile = () =>
  layoutFileFixture({
    timestamp: 1000,
    title: "Header title, edited since",
    logoUrl: "/uploads/logo-now.png",
  });

const layoutSnapshotFile = () =>
  layoutFileFixture({
    timestamp: 700,
    title: "Header title as it was",
    logoUrl: "/uploads/logo-then.png",
  });

/** The terms page: a title, a markdown body, and a field no part of this key's editor has a name for. */
const TERMS_DRAFT_BODY =
  "# Terms now\n\nA body an editor rewrote after the version on offer.";
const TERMS_SNAPSHOT_BODY =
  "# Terms as they were\n\nThe body this version held, paragraph for paragraph.";

const termsFileFixture = ({
  timestamp,
  title,
  bodyMarkdown,
}: {
  timestamp: number;
  title: string;
  bodyMarkdown: string;
}) => ({
  name: "terms-of-service",
  timestamp,
  data: {
    title,
    bodyMarkdown,
    legacyPdfUrl: "/uploads/terms-2019.pdf",
  },
});

const termsDraftFile = () =>
  termsFileFixture({
    timestamp: 1000,
    title: "Terms, edited since",
    bodyMarkdown: TERMS_DRAFT_BODY,
  });

const termsSnapshotFile = () =>
  termsFileFixture({
    timestamp: 700,
    title: "Terms as they were",
    bodyMarkdown: TERMS_SNAPSHOT_BODY,
  });

// -------------------------------------------------------------------- the fake store

type FakeState = {
  draftText: Record<string, string | undefined>;
  snapshotText: Record<string, string | undefined>;
  history: Record<string, HistoryEntry[]>;
  snapshotFailure?: Record<string, Error>;
  calls: string[];
  writes: Array<{ name: string; scope: string; file: unknown }>;
  historyLimits: Array<number | undefined>;
};

const draftText = (): Record<string, string | undefined> => ({
  landing: JSON.stringify(landingDraftFile()),
  layout: JSON.stringify(layoutDraftFile()),
  "terms-of-service": JSON.stringify(termsDraftFile()),
});

const snapshotText = (): Record<string, string | undefined> => ({
  landing: JSON.stringify(landingSnapshotFile()),
  layout: JSON.stringify(layoutSnapshotFile()),
  "terms-of-service": JSON.stringify(termsSnapshotFile()),
});

const history = (): Record<string, HistoryEntry[]> => ({
  landing: [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
  layout: [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
  "terms-of-service": [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
});

/**
 * One fake store for all three whole-record keys, its calls recorded in order.
 *
 * The ordering rule a whole-record restore is built on - read the saved copy, *then* file the copy it is about
 * to write over, then write - is not observable from a returned file, and a disk or a bucket is not something
 * a test may run. Recording what a fake was actually asked to do, in the order it was asked, is what makes
 * that testable.
 *
 * `readHistory` answers the same saved copy whatever it is asked for on purpose: what a test is proving is
 * which tier it was named by, not which copy came out of it.
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
  /**
   * The store's own rule, kept: a baseline is only filed when there is a current copy to file. `false` is the
   * answer for a key with no draft, and it is what makes a whole-record restore into a key that has never had
   * a draft a restore rather than an invention.
   */
  ensureBaselineSnapshot: async (name, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`baseline:${name}:${scoped}`);

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

// One object, mutated in place: every resource module builds its store once at module-load time out of the
// mocked `contentDataStore`, and a fake recorded on something that outlives that load is what a test reads.
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

// Replacing the one function every resource module builds its store out of - with the real module still under
// it - is what lets these tests check the wiring without a bucket or a disk.
vi.mock("#lib/content.server", async () => {
  const actual = await vi.importActual<typeof import("#lib/content.server")>(
    "#lib/content.server",
  );

  return {
    ...actual,
    contentDataStore: () => makeFakeStore(state),
  };
});

// ------------------------------------------------------------------- the three wirings

type RestoreRecordParams = {
  scope: "draft" | "live" | "legacy";
  timestamp: number;
  now?: Date;
};

type WholeRecordWiring = {
  key: string;
  label: string;
  /** The message this resource's own readers expect for a saved copy that is not its shape. */
  invalidMessage: string;
  /** The titles the version on offer holds, in the order it holds them. */
  snapshotTitles: string[];
  /**
   * A field the saved copy holds that this key's file schema does not name, spelled the way JSON spells it -
   * long enough to be a key and not a piece of some other word. It is the card's warning, written as a marker
   * a test can find in one record and not in the other.
   */
  unnamedFieldMarker: string;
  snapshotFile: () => unknown;
  draftFile: () => unknown;
  titlesOf: (file: unknown) => string[];
  idsOf: (file: unknown) => number[];
  /** The ids the draft holds now, and the ids the version on offer holds - read out of each record. */
  draftIds: number[];
  snapshotIds: number[];
  listVersions: (
    limit?: number,
  ) => Promise<Array<{ timestamp: number; scope: string }>>;
  readSnapshotRecord: (
    scope: "draft" | "live" | "legacy",
    timestamp: number,
  ) => Promise<unknown>;
  restore: (params: RestoreRecordParams) => Promise<unknown>;
};

const landingTitlesOf = (file: unknown) =>
  toLandingEditorValue(file as LandingFile).sections.map(
    (section) => section.title,
  );

/**
 * The three server modules are loaded dynamically: each one builds its store the moment it loads, and the
 * mocked `contentDataStore` has to be in place before that happens - not during the import of this file.
 */
let servers: {
  landing: typeof import("#lib/editing/resources/landing/landing.server");
  layout: typeof import("#lib/editing/resources/layout/layout.server");
  termsOfService: typeof import("#lib/editing/resources/terms-of-service/terms-of-service.server");
};

const resources: WholeRecordWiring[] = [
  {
    key: "landing",
    label: "home page",
    invalidMessage: "Invalid landing data file.",
    snapshotTitles: [
      "Intro as it was",
      "News as it was",
      "Books as it was",
      "Galleries as it was",
    ],
    // Each home-page section's media record: named by no part of `landingFileC`, and so gone from a restored
    // draft - which is why a landing picker talks about the sections an editor can write, not a home page.
    unnamedFieldMarker: '"image":',
    snapshotFile: landingSnapshotFile,
    draftFile: landingDraftFile,
    titlesOf: landingTitlesOf,
    // The home page record is this key's only entry, and its sections are what that record is made of - which
    // is exactly why a per-section restore was never on the table for it.
    idsOf: (file) =>
      toLandingEditorValue(file as LandingFile).sections.map(
        (section) => section.id,
      ),
    draftIds: [5, 2, 9],
    snapshotIds: [5, 7, 2, 4],
    listVersions: (limit) =>
      servers.landing.listLandingEditorHistoryVersions(limit),
    readSnapshotRecord: (scope, timestamp) =>
      servers.landing.readLandingEditorSnapshotRecord(scope, timestamp),
    restore: (params) =>
      servers.landing.restoreLandingRecordFromSnapshot(params),
  },
  {
    key: "layout",
    label: "site layout",
    invalidMessage: "Invalid layout data file.",
    snapshotTitles: ["Header title as it was"],
    // The header component tree a real layout copy holds, and `layoutFileC` does not name. Written with its
    // colon so it cannot be mistaken for the `formats` a media record also holds.
    unnamedFieldMarker: '"form":',
    snapshotFile: layoutSnapshotFile,
    draftFile: layoutDraftFile,
    titlesOf: (file) => [toLayoutEditorValue(file as LayoutFile).title],
    idsOf: (file) =>
      ((file as LayoutFile).data?.data ?? []).map((entry) => entry.id ?? 0),
    // One header record in the draft and one in the version: the same id, because this key's ids are the
    // Strapi entry ids its record has always had - and nothing a restore could pick a single one of.
    draftIds: [3],
    snapshotIds: [3],
    listVersions: (limit) =>
      servers.layout.listLayoutEditorHistoryVersions(limit),
    readSnapshotRecord: (scope, timestamp) =>
      servers.layout.readLayoutEditorSnapshotRecord(scope, timestamp),
    restore: (params) => servers.layout.restoreLayoutRecordFromSnapshot(params),
  },
  {
    key: "terms-of-service",
    label: "terms of service",
    invalidMessage: "Invalid terms-of-service data file.",
    snapshotTitles: ["Terms as they were"],
    // A file link the terms record once carried, and no field of this key's editor has ever had a name for.
    unnamedFieldMarker: '"legacyPdfUrl":',
    snapshotFile: termsSnapshotFile,
    draftFile: termsDraftFile,
    titlesOf: (file) => [
      toTermsOfServiceEditorValue(file as TermsOfServiceFile).title,
    ],
    // A terms record has nothing that could be called an entry: its whole `data` is one title and one body.
    idsOf: () => [],
    draftIds: [],
    snapshotIds: [],
    listVersions: (limit) =>
      servers.termsOfService.listTermsOfServiceEditorHistoryVersions(limit),
    readSnapshotRecord: (scope, timestamp) =>
      servers.termsOfService.readTermsOfServiceEditorSnapshotRecord(
        scope,
        timestamp,
      ),
    restore: (params) =>
      servers.termsOfService.restoreTermsOfServiceRecordFromSnapshot(params),
  },
];

const settled = async (run: () => Promise<unknown>) =>
  await run().then(
    () => undefined,
    (cause: unknown) => cause,
  );

const messageOf = (cause: unknown) =>
  String((cause as Error)?.message ?? cause);

const writtenFile = (index = 0) =>
  state.writes[index]?.file as { name: string; timestamp: number };

describe("restoring a whole saved record through each whole-record key's own wiring", () => {
  beforeAll(async () => {
    servers = {
      landing: await import("#lib/editing/resources/landing/landing.server"),
      layout: await import("#lib/editing/resources/layout/layout.server"),
      termsOfService:
        await import("#lib/editing/resources/terms-of-service/terms-of-service.server"),
    };
  });

  resources.forEach((resource) => {
    describe(`the ${resource.key} wiring`, () => {
      beforeEach(() => {
        resetState();
      });

      it(`lists the versions a whole-record restore screen offers, legacy tier visible`, async () => {
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

      it(`asks for no more versions than it was told to, and leaves the rest unread`, async () => {
        await resource.listVersions(2);

        expect(state.historyLimits).toEqual([2]);
        expect(state.calls).toEqual([`listHistory:${resource.key}:all`]);
      });

      it(`reads one saved version as the whole record its schema names`, async () => {
        const record = await resource.readSnapshotRecord("legacy", 700);

        expect(resource.titlesOf(record)).toEqual(resource.snapshotTitles);
        // The saved copy holds this field and the read does not hand it over: a whole-record restore's *read*
        // is already the projection its key's schema names, so a field beyond that schema never survives far
        // enough to reach the write step.
        expect(JSON.stringify(record)).not.toContain(
          resource.unnamedFieldMarker,
        );
        expect(JSON.stringify(resource.snapshotFile())).toContain(
          resource.unnamedFieldMarker,
        );
        expect(state.calls).toEqual([`readHistory:${resource.key}:700:legacy`]);
      });

      it(`restores the whole record as a new draft, filing what it replaces first`, async () => {
        await resource.restore({ scope: "legacy", timestamp: 700, now: NOW });

        // The whole feature in one line of calls: read the saved copy, then file the copy that is about to be
        // written over, then write. Anything written before that baseline exists is a draft nobody can undo.
        expect(state.calls).toEqual([
          `readHistory:${resource.key}:700:legacy`,
          `baseline:${resource.key}:draft`,
          `writeFile:${resource.key}:draft`,
        ]);

        const written = writtenFile();

        expect(written.name).toBe(resource.key);
        // The restored draft carries the moment the restore happened - not the version's timestamp, and not the
        // draft's own - because it is the copy a later save files as the thing a restore undid.
        expect(written.timestamp).toBe(NOW.getTime());
        expect(state.writes.map((write) => write.scope)).toEqual(["draft"]);
      });

      it(`brings the saved version's own record back, whole`, async () => {
        await resource.restore({ scope: "legacy", timestamp: 700, now: NOW });

        expect(resource.titlesOf(state.writes[0]?.file)).toEqual(
          resource.snapshotTitles,
        );
      });

      it(`restores a whole record whole, not as a merge into what the draft holds`, async () => {
        await resource.restore({ scope: "legacy", timestamp: 700, now: NOW });

        // A whole-record restore has no merge that keeps only what the draft still recognises: the whole saved
        // record is the draft now. For `landing` that is visible in its own ids - the section a later save
        // deleted (7) and the one only this version held (4) both come back in the version's order, and the
        // section only the draft ever held (9) is gone.
        expect(resource.idsOf(resource.draftFile())).toEqual(resource.draftIds);
        expect(resource.idsOf(state.writes[0]?.file)).toEqual(
          resource.snapshotIds,
        );
      });

      it(`restores out of a published version without touching that version`, async () => {
        await resource.restore({ scope: "live", timestamp: 900, now: NOW });

        expect(state.calls).toEqual([
          `readHistory:${resource.key}:900:live`,
          `baseline:${resource.key}:draft`,
          `writeFile:${resource.key}:draft`,
        ]);
        // Restoring out of a published version does not write to it, and it does not publish the draft it
        // produced either: publishing is a decision a person makes, and this card's rule is that a restore
        // never touches live.
        expect(
          state.calls.filter(
            (call) =>
              call.startsWith("writeFile") || call.startsWith("release"),
          ),
        ).toEqual([`writeFile:${resource.key}:draft`]);
        expect(state.writes.map((write) => write.scope)).toEqual(["draft"]);
      });

      it(`restores into a key that has no draft yet, without inventing a copy nobody filed`, async () => {
        // `terms-of-service` in the real data: bundled, then legacy, and no draft tier at all - which is why
        // the whole-record path asks the store directly instead of needing a draft to restore into, the way
        // the per-entry path does.
        state.draftText[resource.key] = undefined;

        await resource.restore({ scope: "legacy", timestamp: 700, now: NOW });

        expect(state.calls).toEqual([
          `readHistory:${resource.key}:700:legacy`,
          `baseline:${resource.key}:draft`,
          `writeFile:${resource.key}:draft`,
        ]);
        // That baseline call answered `false`, so the only thing written is the restored record itself - and it
        // is what a later save will file in its place.
        expect(state.writes.length).toBe(1);
        expect(state.writes[0]?.scope).toBe("draft");
      });

      it(`refuses a version that is not in the history as a missing version, not as an outage`, async () => {
        state.snapshotText[resource.key] = undefined;

        const cause = await settled(() =>
          resource.restore({ scope: "legacy", timestamp: 700, now: NOW }),
        );

        // `MissingSnapshotError` is dressed into the same refusal a page sees for bad content, which is what
        // lets each route tell "that version is gone" apart from "the bucket is unreachable" - and write only
        // the second of the two to its log.
        expect(messageOf(cause)).toMatch(/700/);
        expect(messageOf(cause)).toMatch(/is not held in legacy history/);
        expect(cause).not.toBeInstanceOf(MissingSnapshotError);
        expect(state.writes).toEqual([]);
      });

      it(`refuses a saved copy that is not this key's shape, with this key's own message`, async () => {
        state.snapshotText[resource.key] = JSON.stringify({
          nonsense: { sections: [] },
        });

        const cause = await settled(() =>
          resource.restore({ scope: "legacy", timestamp: 700, now: NOW }),
        );

        expect(messageOf(cause)).toContain(resource.invalidMessage);
        // A copy this key cannot read is refused before anything is filed or written: a whole-record replace
        // that half worked would be the one thing this path must never be.
        expect(state.calls).toEqual([`readHistory:${resource.key}:700:legacy`]);
        expect(state.writes).toEqual([]);
      });

      it(`hands a store outage up as itself rather than as a version that is not there`, async () => {
        state.snapshotFailure = {
          [resource.key]: new Error("bucket unreachable"),
        };

        const cause = await settled(() =>
          resource.restore({ scope: "legacy", timestamp: 700, now: NOW }),
        );

        expect(cause).toBeInstanceOf(Error);
        expect(messageOf(cause)).toBe("bucket unreachable");
        expect(cause).not.toBeInstanceOf(MissingSnapshotError);
        expect(state.writes).toEqual([]);
      });

      it(`writes back only what this key's own codec can name`, async () => {
        // The card's one real catch, measured rather than asserted: `landingFileC` names the home page's
        // editable surface and nothing else, and `layoutFileC` does the same for a header - so what a saved
        // copy carries beyond that never travels into the draft. A landing section's image record and a
        // layout copy's whole header component tree are gone from a restored draft, and the picker's warning
        // about "the record this editor can write" is the honest version of what a restore does.
        expect(JSON.stringify(resource.snapshotFile())).toContain(
          resource.unnamedFieldMarker,
        );

        await resource.restore({ scope: "legacy", timestamp: 700, now: NOW });

        expect(JSON.stringify(state.writes[0]?.file)).not.toContain(
          resource.unnamedFieldMarker,
        );
        // What the record *does* hold comes back, so this is a projection and not a broken write: the version's
        // own titles are in the draft that was just written.
        expect(JSON.stringify(state.writes[0]?.file)).toContain(
          resource.snapshotTitles[0] ?? "",
        );
      });
    });
  });
});
// ------------------------------------------------- the three whole-record editor routes

/**
 * The flow the card is about, in the pages that actually show it: the version list, then the whole record that
 * version holds, then the confirmation, then the line the page shows afterwards.
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

const READ_NOTE =
  "That version could not be read. Pick a version from the list below - nothing has been written to your draft.";

const NAME_NOTE =
  "A version to restore must be named by a timestamp and one of draft, live or legacy. Pick a version from the list below.";

/** One whole-record picker's data, in the shape every one of these three pages builds. */
type RestorePanelData = {
  open: boolean;
  href: string;
  closeHref: string;
  versionsHref: string;
  actionHref: string;
  draftVersion: number;
  note: string | null;
  versions: Array<{
    timestamp: number;
    scope: string;
    dateLabel: string;
    tierLabel: string;
    href: string;
  }>;
  record: {
    timestamp: number;
    scope: string;
    dateLabel: string;
    tierLabel: string;
    items: Array<{ label: string; value: string }>;
    comparison: string;
  } | null;
};

type EditorPageData = {
  savedTitle: string | null;
  savedMessage: string | null;
  restore: RestorePanelData;
};

type WholeRecordRoute = {
  key: string;
  label: string;
  /** The page these tests open the picker on. */
  editorPath: string;
  /** Where a successful restore sends the editor. */
  heldPath: string;
  /** The `params` key this route's page names, and the prefix it sits under - `null` for a fixed route. */
  paramKey: string | null;
  pathPrefix: string | null;
  successMessage: (restored: { title: string }) => string;
  refusalMessage: string;
  importPage: () => Promise<unknown>;
};

const routes: WholeRecordRoute[] = [
  {
    key: "landing",
    label: "home page",
    // A section the restored version does not hold, so the link a restore sends the editor to is provably not
    // the page the editor was standing on when it clicked.
    editorPath: "/landing/edit/9",
    heldPath: "/landing/edit/5",
    paramKey: "sid",
    pathPrefix: "/landing/edit",
    successMessage: ({ title }) =>
      `Restored the home page ("${title}") - whole record, every section - from the version saved 1 January 1970 at 00:00 (pre-S3 copy).`,
    refusalMessage:
      "Nothing was restored: that version of the home page could not be read. Your current home page draft is unchanged.",
    importPage: () =>
      import("../../src/routes/landing/edit/[...sid]/+page.server"),
  },
  {
    key: "layout",
    label: "site layout",
    editorPath: "/layout/edit",
    heldPath: "/layout/edit",
    paramKey: null,
    pathPrefix: null,
    successMessage: ({ title }) =>
      `Restored the site layout ("${title}") - header title and logo, whole record - from the version saved 1 January 1970 at 00:00 (pre-S3 copy).`,
    refusalMessage:
      "Nothing was restored: that version of the site layout could not be read. Your current site layout draft is unchanged.",
    importPage: () => import("../../src/routes/layout/edit/+page.server"),
  },
  {
    key: "terms-of-service",
    label: "terms of service",
    editorPath: "/terms-of-service/edit",
    heldPath: "/terms-of-service/edit",
    paramKey: null,
    pathPrefix: null,
    successMessage: ({ title }) =>
      `Restored the terms of service ("${title}") - title and body, whole record - from the version saved 1 January 1970 at 00:00 (pre-S3 copy).`,
    refusalMessage:
      "Nothing was restored: that version of the terms of service could not be read. Your current terms of service draft is unchanged.",
    importPage: () =>
      import("../../src/routes/terms-of-service/edit/+page.server"),
  },
];

/** The title each key's restored record carries, taken from the version the restore brings back. */
const RESTORED_TITLES: Record<string, string> = {
  landing: "Home page as it was",
  layout: "Header title as it was",
  "terms-of-service": "Terms as they were",
};

const paramsFor = (route: WholeRecordRoute, pathname: string) =>
  route.paramKey === null || route.pathPrefix === null
    ? {}
    : { [route.paramKey]: pathname.slice(route.pathPrefix.length + 1) };

const openPageAt = async (
  route: WholeRecordRoute,
  pathname: string,
  search: string,
) => {
  const page = (await route.importPage()) as {
    load: (input: never) => Promise<unknown>;
  };

  return loadResult(
    await page.load({
      cookies: fakeCookies(),
      params: paramsFor(route, pathname),
      url: new URL(`http://localhost${pathname}${search}`),
    } as never),
  ) as unknown as EditorPageData;
};

const openPage = (route: WholeRecordRoute, search: string) =>
  openPageAt(route, route.editorPath, search);

/**
 * The confirmation form every one of these pickers posts: a version, named by its timestamp and the tier it was
 * found in, and nothing else - no entry id, because a whole-record restore has no entry to name.
 */
const confirmRestore = async (
  route: WholeRecordRoute,
  fields: Record<string, string> = {},
) => {
  const page = (await route.importPage()) as {
    actions: Record<string, (input: never) => Promise<unknown>>;
  };
  const formData = new FormData();

  Object.entries({
    scope: "legacy",
    timestamp: "700",
    draftVersion: "1000",
    ...fields,
  }).forEach(([name, value]) => formData.set(name, value));

  return (await settled(() =>
    page.actions.restore({
      cookies: fakeCookies(),
      request: { formData: async () => formData },
      url: new URL(`http://localhost${route.editorPath}`),
    } as never),
  )) as { status: number; location: string };
};

const searchOf = (location: string) => {
  const index = location.indexOf("?");

  return index === -1 ? "" : location.slice(index);
};

const pathOf = (location: string) => {
  const index = location.indexOf("?");

  return index === -1 ? location : location.slice(0, index);
};

describe("restoring a whole saved record out of a version in each whole-record editor route", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetState();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  routes.forEach((route) => {
    describe(`${route.key}: the whole record through the version list, the confirmation and the line afterwards`, () => {
      it("restores the whole record into the draft and sends the editor to a link naming version and tier", async () => {
        const refusal = await confirmRestore(route);

        expect(refusal.status).toBe(303);
        // The editor lands on the record it restored, in a link that names the version and the tier - which is
        // what the page's next line is built out of.
        expect(pathOf(refusal.location)).toBe(route.heldPath);
        expect(searchOf(refusal.location)).toBe("?restored=700&scope=legacy");

        expect(state.calls).toEqual([
          `readHistory:${route.key}:700:legacy`,
          `baseline:${route.key}:draft`,
          `writeFile:${route.key}:draft`,
        ]);
        // Every tier this page touched during a restore is a tier it read from, and the only tier it wrote is
        // the draft it protected first. Publishing that draft is the next card's decision, not this page's.
        expect(state.writes.map((write) => write.scope)).toEqual(["draft"]);
        expect(
          state.calls.filter((call) => call.startsWith("release")),
        ).toEqual([]);

        const written = writtenFile();

        // The restored draft carries the moment the restore happened - not the version's timestamp, and not the
        // draft's own - because it is the copy a later save files as the thing a restore undid.
        expect(written.timestamp).toBeGreaterThan(
          new Date("2026-01-01T00:00:00.000Z").getTime(),
        );
      });

      it("lands on a record the restored version actually holds, not on the page the editor was standing on", async () => {
        const refusal = await confirmRestore(route);

        // A hand-chosen `?restoreVersion` cannot smuggle an editor out of their own route, but a whole-record
        // restore does move the editor: for `landing` the section the editor was editing may be a section the
        // version that just got restored does not hold at all, and a redirect to it would be a 404 wearing the
        // words "restore complete".
        expect(pathOf(refusal.location)).toBe(route.heldPath);

        const page = await openPageAt(
          route,
          route.heldPath,
          searchOf(refusal.location),
        );

        expect(page.savedTitle).toBe("Restore complete");
      });

      it("names the record that came back and the version it came out of, in the line the page shows next", async () => {
        const refusal = await confirmRestore(route);
        const page = await openPageAt(
          route,
          route.heldPath,
          searchOf(refusal.location),
        );

        expect(page.savedTitle).toBe("Restore complete");
        // The line names the title the restored record carries, which is the version's own - so it names what
        // the editor can now see in the form, not what the form held before.
        expect(page.savedMessage).toBe(
          route.successMessage({ title: RESTORED_TITLES[route.key] ?? "" }),
        );
      });

      it("refuses out loud when a restore failed, without pretending a record was restored", async () => {
        const page = await openPage(route, "?restore-failed=1");

        expect(page.savedTitle).toBe("Nothing restored");
        expect(page.savedMessage).toBe(route.refusalMessage);
        expect(page.restore.open).toBe(false);

        // A hand-edited `?restored` link says nothing at all rather than claiming nothing happened: this page
        // cannot tell a restore that just worked from an old link somebody pasted again.
        const guessed = await openPage(route, "?restored=maybe&scope=legacy");

        expect(guessed.savedTitle).toBeNull();
        expect(guessed.savedMessage).toBeNull();
      });

      it.each([
        {
          label: "a tier it was never allowed to name",
          fields: { scope: "published" },
        },
        {
          label: "a tier that is one of its own words, but spelt wrong",
          fields: { scope: "Draft" },
        },
        {
          label: "a version number that is not a number",
          fields: { timestamp: "not-a-number" },
        },
        {
          label: "a version number with a decimal point in it",
          fields: { timestamp: "700.5" },
        },
        {
          label: "a version number that is negative",
          fields: { timestamp: "-700" },
        },
        { label: "the version number zero", fields: { timestamp: "0" } },
        { label: "no version at all", fields: { timestamp: "" } },
      ])(
        "refuses a confirmation form holding $label before asking the store for anything",
        async ({ fields }) => {
          const refusal = await confirmRestore(route, fields);

          expect(refusal.status).toBe(303);
          expect(pathOf(refusal.location)).toBe(route.editorPath);
          expect(searchOf(refusal.location)).toBe("?restore-failed=1");
          // Refused before the store is asked anything at all - and `?restore-failed=1` is the only shape a
          // refusal is routed in, so the line an editor is shown never depends on a message this page would have
          // to guess at. A `0` is refused out loud rather than renamed into something a seam would swallow.
          expect(state.calls).toEqual([]);
          expect(state.writes).toEqual([]);
        },
      );

      it("ignores an entry id it is handed, because a whole-record restore has no entry to name", async () => {
        // A per-entry restore needs an id; a whole-record restore has none, and it neither needs one nor claims
        // to have honoured one. The seam is the only thing under this page that writes, so what this proves is
        // that the extra field changes nothing a restore does.
        const refusal = await confirmRestore(route, { entryId: "42" });

        expect(pathOf(refusal.location)).toBe(route.heldPath);
        expect(state.writes.map((write) => write.scope)).toEqual(["draft"]);
      });

      it("writes nothing when the version it was sent is not held in the tier it was named in, and keeps that refusal out of the log", async () => {
        state.snapshotText[route.key] = undefined;

        const refusal = await confirmRestore(route);

        expect(searchOf(refusal.location)).toBe("?restore-failed=1");
        expect(state.writes).toEqual([]);
        expect(state.calls).toEqual([`readHistory:${route.key}:700:legacy`]);
        // The seam dresses a version it cannot find into an HTTP error, which is what lets this page keep a
        // dressed refusal out of the log while it still writes an outage to it.
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("writes nothing when the store is not answering, and refuses to call an outage a missing version", async () => {
        state.snapshotFailure = {
          [route.key]: new Error("bucket unreachable"),
        };

        const refusal = await confirmRestore(route);

        expect(searchOf(refusal.location)).toBe("?restore-failed=1");
        expect(state.writes).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[1]).toBeInstanceOf(Error);
      });

      it("offers the versions it can reach, five at most, each link sending the tier it was found in", async () => {
        state.history[route.key] = [
          { timestamp: 5000, scope: "draft" },
          { timestamp: 4000, scope: "live" },
          { timestamp: 3000, scope: "legacy" },
          { timestamp: 2000, scope: "draft" },
          { timestamp: 1500, scope: "live" },
          { timestamp: 1000, scope: "legacy" },
        ];

        const page = await openPage(route, "?restore=1");

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
          `${route.editorPath}?restore=1&restoreVersion=3000&restoreScope=legacy`,
        );
        expect(page.restore.actionHref).toBe(`${route.editorPath}?/restore`);
        // The link that closes the picker is the editor's own path, not a query - which is what the browser's
        // back button ends up being a copy of.
        expect(page.restore.closeHref).toBe(route.editorPath);
      });

      it("opens on a bare ?restore and on ?restore=1 alike, and never hands the sentinel's value to the store as a version number", async () => {
        const bare = await openPage(route, "?restore");
        const valued = await openPage(route, "?restore=1700000000000");

        expect(bare.restore.open).toBe(true);
        expect(bare.restore.record).toBeNull();
        expect(valued.restore.open).toBe(true);
        expect(valued.restore.record).toBeNull();
        // The value of `?restore` says which control opened the dialog, not which version to read. Reading it as
        // a timestamp is how a version from November 2023 would arrive at the store unasked.
        expect(
          state.calls.filter((call) => call.startsWith("readHistory")),
        ).toEqual([]);
        expect(state.historyLimits).toEqual([5, 5]);
      });

      it("pays nothing in history for the ordinary editor view", async () => {
        const page = await openPage(route, "");

        expect(page.restore.open).toBe(false);
        expect(page.restore.record).toBeNull();
        expect(page.restore.versions).toEqual([]);
        // No `?restore`, no history listing, no snapshot read: an editor who never opens the picker is not
        // paying for one, and a picker that is open is the only thing that asks.
        expect(
          state.calls.filter(
            (call) =>
              call.startsWith("readHistory") || call.startsWith("listHistory"),
          ),
        ).toEqual([]);
      });

      it("refuses a version named by a timestamp it cannot read, before asking the store for anything", async () => {
        const page = await openPage(
          route,
          "?restore=1&restoreVersion=0&restoreScope=maybe",
        );

        expect(page.restore.record).toBeNull();
        expect(page.restore.note).toBe(NAME_NOTE);
        // A zero is refused out loud rather than renamed, and nothing is read: the picker is still open, and the
        // versions it can reach are still listed.
        expect(state.historyLimits).toEqual([5]);
        expect(
          state.calls.filter((call) => call.startsWith("readHistory")),
        ).toEqual([]);
      });

      it("refuses a version named by a tier it does not know, and still names no record", async () => {
        const page = await openPage(
          route,
          "?restore=1&restoreVersion=700&restoreScope=bundled",
        );

        expect(page.restore.record).toBeNull();
        expect(page.restore.note).toBe(NAME_NOTE);
        expect(
          state.calls.filter((call) => call.startsWith("readHistory")),
        ).toEqual([]);
      });

      it("says which version it could not read, instead of showing an empty record or a raw outage", async () => {
        state.snapshotText[route.key] = undefined;

        const missing = await openPage(
          route,
          "?restore=1&restoreVersion=700&restoreScope=legacy",
        );

        expect(missing.restore.record).toBeNull();
        expect(missing.restore.note).toBe(READ_NOTE);
        // The versions that *can* be read are still offered, so the note is an explanation and not a wall.
        expect(
          missing.restore.versions.map((version) => version.timestamp),
        ).toEqual([1000, 900, 700]);
        expect(consoleError).not.toHaveBeenCalled();

        state.snapshotFailure = {
          [route.key]: new Error("bucket unreachable"),
        };

        const outage = await openPage(
          route,
          "?restore=1&restoreVersion=700&restoreScope=legacy",
        );

        expect(outage.restore.note).toBe(READ_NOTE);
        // The note an editor is shown is the same either way, and the log is what makes the two tellable apart:
        // a refusal the seam already dressed is not written to it, an outage is.
        expect(consoleError).toHaveBeenCalledTimes(1);
      });

      it("keeps an editor out of a record the restored version does not hold", async () => {
        // `restore-failed` is the only shape a refusal travels in, and a route that could not read a version
        // never half-restores into the record it is on: the draft the editor was reading is still what they are
        // reading.
        state.snapshotText[route.key] = undefined;

        const before = state.draftText[route.key];
        const refusal = await confirmRestore(route);

        expect(searchOf(refusal.location)).toBe("?restore-failed=1");
        expect(state.draftText[route.key]).toBe(before);
      });
    });
  });
});
describe("the confirmation step of a whole-record restore, one test for each of the three", () => {
  beforeEach(() => {
    resetState();
  });

  it("names the whole home page a saved version holds, section by section, before anything is replaced", async () => {
    const confirm = await openPageAt(
      routes[0]!,
      routes[0]!.editorPath,
      "?restore=1&restoreVersion=700&restoreScope=legacy",
    );
    const record = confirm.restore.record!;
    const draft = toLandingEditorValue(landingDraftFile());
    const saved = toLandingEditorValue(landingSnapshotFile());

    expect(confirm.restore.open).toBe(true);
    expect(record.scope).toBe("legacy");
    expect(record.tierLabel).toBe("(pre-S3 copy)");
    expect(record.dateLabel).toBe("1 January 1970 at 00:00");
    // A landing restore cannot name a single entry, so what its confirmation step names instead is every part
    // the record is made of - in the version's own order, including a section a later save deleted and one only
    // this version held. An editor replacing the whole home page is shown the whole home page.
    expect(record.items).toEqual([
      { label: "Section 5 (1 of 4)", value: '"Intro as it was"' },
      { label: "Section 7 (2 of 4)", value: '"News as it was"' },
      { label: "Section 2 (3 of 4)", value: '"Books as it was"' },
      { label: "Section 4 (4 of 4)", value: '"Galleries as it was"' },
    ]);
    // Both counts are read out of the records themselves, because the honest warning for a whole-record restore
    // is about the whole record: a section a draft holds that the version does not is exactly what is about to
    // be replaced.
    expect(record.comparison).toContain("which held 4 sections");
    expect(record.comparison).toContain("holds 3 sections");
    expect(record.comparison).toContain("all 3 of them are replaced");
    // A home page's sections are what its record is made of, so a landing restore was never a per-section one:
    // it is the seam's whole-record half, and the page says so in its own link text.
    expect(draft.sections.map((section) => section.id)).toEqual([5, 2, 9]);
    expect(saved.sections.map((section) => section.id)).toEqual([5, 7, 2, 4]);
  });

  it("names the header this editor changes, in the one version a layout restore could replace", async () => {
    const confirm = await openPageAt(
      routes[1]!,
      routes[1]!.editorPath,
      "?restore=1&restoreVersion=700&restoreScope=legacy",
    );
    const record = confirm.restore.record!;

    expect(record.scope).toBe("legacy");
    expect(record.tierLabel).toBe("(pre-S3 copy)");
    // A layout record's whole editable surface, named on the step that replaces it: the title every page renders
    // as its heading, and the logo that navigation is built out of - and nothing a layout editor does not change.
    expect(record.items).toEqual([
      { label: "Header title", value: '"Header title as it was"' },
      { label: "Logo", value: "/uploads/logo-then.png" },
    ]);
    expect(record.comparison).toContain("held 1 header record");
    expect(record.comparison).toContain("holds 1 header record");
    expect(record.comparison).toContain("it is replaced whole");
    expect(record.comparison).toContain("header title and logo both");
  });

  it("names the title and counts the body a terms record holds, both records read out of the store", async () => {
    const confirm = await openPageAt(
      routes[2]!,
      routes[2]!.editorPath,
      "?restore=1&restoreVersion=700&restoreScope=legacy",
    );
    const record = confirm.restore.record!;
    const draft = toTermsOfServiceEditorValue(termsDraftFile());
    const saved = toTermsOfServiceEditorValue(termsSnapshotFile());

    expect(record.scope).toBe("legacy");
    expect(record.tierLabel).toBe("(pre-S3 copy)");
    expect(record.dateLabel).toBe("1 January 1970 at 00:00");
    // A terms record's body is only ever written through its one field, and what an editor actually changes is
    // markdown - so the honest count is measured off the two records rather than claimed.
    expect(record.items).toEqual([
      { label: "Title", value: '"Terms as they were"' },
      {
        label: "Body",
        value: `${TERMS_SNAPSHOT_BODY.length} characters of markdown`,
      },
    ]);
    expect(record.comparison).toContain(
      `body ${TERMS_SNAPSHOT_BODY.length} characters long`,
    );
    expect(record.comparison).toContain(
      `run ${TERMS_DRAFT_BODY.length} characters long`,
    );
    expect(saved.bodyMarkdown).toContain("Terms as they were");
    expect(draft.bodyMarkdown).toContain("Terms now");
  });
});

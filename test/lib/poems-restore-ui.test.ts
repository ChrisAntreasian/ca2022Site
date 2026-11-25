import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";

import HistoryDialog from "#lib/editing/HistoryDialog.svelte";
import UnsavedChangesDialog from "#lib/form/UnsavedChangesDialog.svelte";

import type { DataStore, HistoryEntry } from "#lib/dataStore.server";
import { fakeCookies } from "../routes/fakeCookies";
import { loadResult } from "../routes/loadResult";

/**
 * Card T6 — the poems editor's restore UI, tested from the page-server side out.
 *
 * `test/lib/poems-restore.test.ts` proves what a restore *decides* and `test/lib/editor-restore.test.ts`
 * proves what the seam asks a store. What is left to prove is the page's own behaviour, and the things worth
 * pinning here are not values either: they are who is asked for what, and what is not written when a restore
 * cannot happen. A restore screen that reads one version, posts one entry id and then silently writes a
 * quarter of a draft is the failure this card has to be able to survive.
 *
 * So: the seam and `poems.ts` are real here, and only the store they read through is replaced - the same
 * trick `test/lib/editor-restore.test.ts` uses for the poems wiring, because `poems.server.ts` builds its
 * store once at import and `contentDataStore()` is the only door it has.
 */

// ------------------------------------------------------------------ the fixtures

/** The current draft: poems 2 and 4, with 19 long since deleted. */
const DRAFT_TEXT = JSON.stringify({
  name: "poems",
  timestamp: 1000,
  data: {
    data: [
      {
        id: 2,
        attributes: {
          createdAt: "2024-01-03T00:00:00.000Z",
          updatedAt: "2024-01-03T00:00:00.000Z",
          publishedAt: "2024-01-03T00:00:00.000Z",
          title: "Cheese",
          body: "the poem the editor keeps",
          featured: false,
          position: 10,
        },
      },
      {
        id: 4,
        attributes: {
          createdAt: "2024-01-04T00:00:00.000Z",
          updatedAt: "2025-01-04T00:00:00.000Z",
          publishedAt: "2024-01-04T00:00:00.000Z",
          title: "The Carpal Tunnel",
          body: "the body a later editor wrote over the old one",
          featured: false,
          position: 40,
        },
      },
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 2 } },
  },
});

/**
 * The same draft as it reads *after* poem 19 has been restored out of the version below - which is what a
 * status line looks a title up from, and why the fixture has to carry 19 to be tested at all.
 */
const DRAFT_AFTER_RESTORE_TEXT = JSON.stringify({
  name: "poems",
  timestamp: 1001,
  data: {
    data: [
      {
        id: 2,
        attributes: {
          createdAt: "2024-01-03T00:00:00.000Z",
          updatedAt: "2024-01-03T00:00:00.000Z",
          publishedAt: "2024-01-03T00:00:00.000Z",
          title: "Cheese",
          body: "the poem the editor keeps",
          featured: false,
          position: 10,
        },
      },
      {
        id: 4,
        attributes: {
          createdAt: "2024-01-04T00:00:00.000Z",
          updatedAt: "2025-01-04T00:00:00.000Z",
          publishedAt: "2024-01-04T00:00:00.000Z",
          title: "The Carpal Tunnel",
          body: "the body a later editor wrote over the old one",
          featured: false,
          position: 40,
        },
      },
      {
        id: 19,
        attributes: {
          createdAt: "2020-01-19T00:00:00.000Z",
          updatedAt: "2020-06-19T00:00:00.000Z",
          publishedAt: "2020-01-19T00:00:00.000Z",
          title: "Ooo",
          body: "the body this version had",
          featured: false,
          position: 190,
        },
      },
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 3 } },
  },
});

/**
 * One saved version, held in `legacy`: poem 4 the way it then read, and poem 19 the current draft no longer
 * has. Both are needed to make the picker's marking observable: one entry the draft still holds and one it
 * lost.
 */
const SNAPSHOT_TEXT = JSON.stringify({
  name: "poems",
  timestamp: 1792900000000,
  data: {
    data: [
      {
        id: 4,
        attributes: {
          createdAt: "2024-01-04T00:00:00.000Z",
          updatedAt: "2024-02-04T00:00:00.000Z",
          publishedAt: "2024-01-04T00:00:00.000Z",
          title: "The Carpal Tunnel as it was",
          body: "the body this version had",
          featured: true,
          position: 40,
        },
      },
      {
        id: 19,
        attributes: {
          createdAt: "2020-01-19T00:00:00.000Z",
          updatedAt: "2020-06-19T00:00:00.000Z",
          publishedAt: "2020-01-19T00:00:00.000Z",
          title: "Ooo",
          body: "the body this version had",
          featured: false,
          position: 190,
        },
      },
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 2 } },
  },
});

/**
 * A saved copy this page's own codec cannot read: an id stored as a string is not a number, and every local
 * snapshot - like every one of this project's poems files - stores its ids as numbers. `readSnapshot` reads
 * a version through the same schema a current draft is read with, so a copy shaped like this one refuses the
 * write it would have made, and nothing else.
 */
const BAD_SNAPSHOT_TEXT = JSON.stringify({
  name: "poems",
  timestamp: 1792900000000,
  data: {
    data: [
      {
        id: "19",
        attributes: {
          createdAt: "2020-01-19T00:00:00.000Z",
          updatedAt: "2020-06-19T00:00:00.000Z",
          publishedAt: "2020-01-19T00:00:00.000Z",
          title: "Ooo",
          body: "a body attached to an id this codec would refuse",
          featured: false,
          position: 190,
        },
      },
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 1 } },
  },
});

const RESTORED_VERSION = 1792900000000;
const OUTAGE = new Error("The S3 bucket is unreachable");

/**
 * Six versions across the three tiers, newest first by design so that the fifth one is the last one a picker
 * may show and the sixth is a version the screen never learns about.
 */
const VERSION_ENTRIES: HistoryEntry[] = [
  { timestamp: 1793775110415, scope: "draft" },
  { timestamp: RESTORED_VERSION, scope: "legacy" },
  { timestamp: 1790025623841, scope: "live" },
  { timestamp: 1785422380586, scope: "legacy" },
  { timestamp: 1778000000000, scope: "draft" },
  { timestamp: 1770000000000, scope: "legacy" },
];

// ------------------------------------------------------------------ the fake store

type FakeState = {
  draftText?: string;
  /** Snapshot JSON, keyed `scope:timestamp`. An unlisted key is a genuine miss. */
  snapshots: Record<string, string>;
  /** Keys whose `readHistory` fails as a store outage rather than as a missing version. */
  outages: Record<string, Error>;
  baselineCreated: boolean;
  entries: HistoryEntry[];
  /** Every store method records itself here, in the order it was called. */
  calls: string[];
  writes: Array<{ name: string; scope: string; file: unknown }>;
};

const makeState = (overrides: Partial<FakeState> = {}): FakeState => ({
  draftText: DRAFT_TEXT,
  snapshots: { [`legacy:${RESTORED_VERSION}`]: SNAPSHOT_TEXT },
  outages: {},
  baselineCreated: true,
  entries: VERSION_ENTRIES,
  calls: [],
  writes: [],
  ...overrides,
});

const snapshotKey = (scope: string, timestamp: number) =>
  `${scope}:${timestamp}`;

/**
 * `isMissingSnapshot` classifies a miss with `instanceof`, and `vi.resetModules()` re-evaluates the module the
 * class is exported from - so the fake has to throw whichever copy of the class the seam is holding, resolved
 * after each reset. A stale copy arrives at the seam as an object the seam passes through as itself, which
 * looks exactly like a store outage and is nothing of the kind.
 */
let MissingSnapshotClass: typeof import("#lib/dataStore.server").MissingSnapshotError;

const resetModulesAndStore = async () => {
  vi.resetModules();
  MissingSnapshotClass = (await import("#lib/dataStore.server"))
    .MissingSnapshotError;
};

const makeFakeStore = (state: FakeState): DataStore => ({
  readFile: vi.fn(async (name, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`readFile:${name}:${scoped}`);

    if (state.draftText === undefined) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }

    return state.draftText;
  }),
  writeFile: vi.fn(async (name, file, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`writeFile:${name}:${scoped}`);
    state.writes.push({ name, scope: scoped, file });
  }),
  ensureBaselineSnapshot: vi.fn(async (name, scope) => {
    state.calls.push(`baseline:${name}:${scope ?? "draft"}`);

    return state.draftText === undefined ? false : state.baselineCreated;
  }),
  release: vi.fn(async (name) => {
    state.calls.push(`release:${name}`);

    return 1;
  }),
  listHistory: vi.fn(async (name, options) => {
    const scope = options?.scope ?? "all";
    // The limit is recorded, because "the screen offers five" is only proven by what the screen asks for.
    state.calls.push(
      `listHistory:${name}:${scope}:${options?.limit ?? "unset"}`,
    );

    const sorted = [...state.entries].sort(
      (left, right) => right.timestamp - left.timestamp,
    );

    return options?.limit === undefined
      ? sorted
      : sorted.slice(0, options.limit);
  }),
  readHistory: vi.fn(async (name, timestamp, scope) => {
    const scoped = scope ?? "draft";
    const key = snapshotKey(scoped, timestamp);
    state.calls.push(`readHistory:${name}:${timestamp}:${scoped}`);

    const outage = state.outages[key];

    if (outage) throw outage;

    const text = state.snapshots[key];

    if (text === undefined) {
      throw new MissingSnapshotClass(name, timestamp, scoped);
    }

    return text;
  }),
});

/**
 * The poems module reads its store through `contentDataStore()`, once, at import - so the fake has to outlive
 * each test while the text it answers with does not.
 */
const poemsState = makeState();

vi.mock("#lib/content.server", async () => {
  const actual = await vi.importActual<typeof import("#lib/content.server")>(
    "#lib/content.server",
  );

  return {
    ...actual,
    contentDataStore: () => makeFakeStore(poemsState),
  };
});

/** Editor auth is mocked wholesale here, exactly as every route suite in `test/routes/` mocks it. */
vi.mock("#lib/editing/core/session.server", () => ({
  requireEditorAccess: vi.fn(),
  isEditorUnlockedForRequest: vi.fn(() => true),
}));

vi.mock("@sveltejs/kit", async () => {
  const actual =
    await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");

  return {
    ...actual,
    redirect: (status: number, location: string) => ({ status, location }),
  };
});

// -------------------------------------------------------------------- the helpers

const EDITOR_PATH = "/poems/edit/4/the-carpal-tunnel";

const editorUrl = (search = "", pathname = EDITOR_PATH) =>
  new URL(`http://localhost${pathname}${search}`);

const loadPage = async ({
  search = "",
  pathname = EDITOR_PATH,
  pid = "4/the-carpal-tunnel",
}: { search?: string; pathname?: string; pid?: string } = {}) => {
  await resetModulesAndStore();

  const { load } =
    await import("../../src/routes/poems/edit/[...pid]/+page.server");

  return loadResult(
    await load({
      cookies: fakeCookies(),
      params: { pid },
      url: editorUrl(search, pathname),
    } as never),
  );
};

const runRestore = async ({
  form,
  search = "",
}: {
  form: Record<string, string>;
  search?: string;
}) => {
  await resetModulesAndStore();

  const { actions } =
    await import("../../src/routes/poems/edit/[...pid]/+page.server");
  const formData = new FormData();

  Object.entries(form).forEach(([name, value]) => formData.set(name, value));

  const restoreAction = (
    actions as unknown as Record<string, (request: never) => Promise<unknown>>
  ).restore;

  return restoreAction({
    cookies: fakeCookies(),
    request: { formData: async () => formData },
    url: editorUrl(search),
  } as never);
};

const formForRestore = (fields: Partial<Record<string, string>> = {}) => ({
  scope: "legacy",
  timestamp: String(RESTORED_VERSION),
  entryId: "19",
  draftVersion: "1000",
  ...fields,
});

/** The entry id the restore wrote into the draft, read back out of what the fake store was handed. */
const writtenPoemIds = (file: unknown) =>
  (file as { data: { data: Array<{ id: number }> } }).data.data.map(
    (item) => item.id,
  );

const REFUSAL_LOCATION = `${EDITOR_PATH}?restore-failed=1`;

// ------------------------------------------------------------------------ the tests

describe("the poems restore picker", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    poemsState.calls.length = 0;
    poemsState.writes.length = 0;
    poemsState.draftText = DRAFT_TEXT;
    poemsState.snapshots = { [`legacy:${RESTORED_VERSION}`]: SNAPSHOT_TEXT };
    poemsState.outages = {};
    poemsState.entries = VERSION_ENTRIES;

    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers five versions at most, newest first, from every tier it can reach", async () => {
    const result = await loadPage({ search: "?restore=1" });

    expect(poemsState.calls).toEqual([
      "readFile:poems:draft",
      "baseline:poems:draft",
      "listHistory:poems:all:5",
    ]);
    expect(result.restore.versions).toHaveLength(5);
    expect(result.restore.versions.map((version) => version.timestamp)).toEqual(
      [
        1793775110415,
        RESTORED_VERSION,
        1790025623841,
        1785422380586,
        1778000000000,
      ],
    );
    expect(poemsState.calls.join()).not.toContain("readHistory");
  });

  it("names every version it offers by the tier it was found in, in the words an editor reads", async () => {
    const result = await loadPage({ search: "?restore=1" });
    const [draft, legacy, live] = result.restore.versions;

    expect(draft?.dateLabel).toBe("4 November 2026 at 06:51");
    expect(draft?.tierLabel).toBe("(draft)");
    expect(legacy?.tierLabel).toBe("(pre-S3 copy)");
    // A live version is not somebody's working copy, and a choice between two snapshots has to say that.
    expect(live?.tierLabel).toBe("(published version)");
    expect(
      result.restore.versions.every((version) =>
        version.href.includes("restore=1"),
      ),
    ).toBe(true);
    expect(
      result.restore.versions.every((version) =>
        version.href.includes(`restoreVersion=${version.timestamp}`),
      ),
    ).toBe(true);
    expect(result.restore.versions[4]?.href).toBe(
      `${EDITOR_PATH}?restore=1&restoreVersion=1778000000000&restoreScope=draft`,
    );
  });

  it("sends a version's own tier with its link, because a legacy version read with the default scope is a miss", async () => {
    const result = await loadPage({ search: "?restore=1" });

    expect(result.restore.versions.map((version) => version.scope)).toEqual([
      "draft",
      "legacy",
      "live",
      "legacy",
      "draft",
    ]);

    const opened = await loadPage({
      search: `?restore=1&restoreVersion=${RESTORED_VERSION}&restoreScope=legacy`,
    });

    expect(poemsState.calls).toContain(
      `readHistory:poems:${RESTORED_VERSION}:legacy`,
    );
    expect(opened.restore.target?.scope).toBe("legacy");
    expect(opened.restore.target?.tierLabel).toBe("(pre-S3 copy)");
  });

  it("opens the picker on a bare ?restore and on ?restore=1 alike, and never sends the sentinel's value to the store as a timestamp", async () => {
    // A store in which the sentinel's own value is, at the same time, a version the editor is genuinely
    // allowed to ask for: a page tempted to read `?restore` as a version number would then have somewhere to
    // succeed, which is precisely the read this test has to be able to see.
    poemsState.entries = [
      { timestamp: RESTORED_VERSION, scope: "legacy" },
      { timestamp: 1, scope: "legacy" },
    ];
    poemsState.snapshots = {
      [`legacy:${RESTORED_VERSION}`]: SNAPSHOT_TEXT,
      [`legacy:${RESTORED_VERSION + 1}`]: SNAPSHOT_TEXT,
      "legacy:1": SNAPSHOT_TEXT,
    };

    for (const search of [
      "?restore",
      "?restore=1",
      "?restore=anything-at-all",
      "?restore=1792900000001",
      // A sentinel value that is a real version number, sent along with a real tier: the tier is all a naive
      // page would need in order to go looking, and still this page asks the store for nothing.
      "?restore=1792900000001&restoreScope=legacy",
      "?restore=1&restoreScope=legacy",
    ]) {
      poemsState.calls.length = 0;

      const result = await loadPage({ search });
      const timestamps = result.restore.versions.map(
        (version) => version.timestamp,
      );

      expect(result.restore.open).toBe(true);
      expect(result.restore.target).toBeNull();
      // Offered as a version, and read as a version: never asked for as a timestamp.
      expect(timestamps).toEqual([RESTORED_VERSION, 1]);
      expect(
        poemsState.calls.filter((call) => call.startsWith("readHistory")),
      ).toEqual([]);
      // Not a version that is gone either: a sentinel that looks like a version is refused as a name, which
      // is a different refusal from the one a store gives for a version it does not hold.
      expect(result.restore.note ?? "").not.toContain("could not be read");
    }
  });

  it("lists one version's poems for the picker, marking each by what the current draft already did to it", async () => {
    const result = await loadPage({
      search: `?restore=1&restoreVersion=${RESTORED_VERSION}&restoreScope=legacy`,
    });
    const entries = result.restore.target?.entries ?? [];

    expect(entries).toEqual([
      { id: 4, title: "The Carpal Tunnel as it was", willReplace: true },
      { id: 19, title: "Ooo", willReplace: false },
    ]);
  });

  it("refuses a version number or a tier it was not allowed to name, without asking the store for either", async () => {
    for (const search of [
      "?restore=1&restoreVersion=1e9&restoreScope=legacy",
      "?restore=1&restoreVersion=abc&restoreScope=legacy",
      "?restore=1&restoreVersion=1792900000000&restoreScope=bucket",
      "?restore=1&restoreVersion=-1792900000000&restoreScope=legacy",
    ]) {
      poemsState.calls.length = 0;

      const result = await loadPage({ search });

      expect(result.restore.open).toBe(true);
      expect(result.restore.target).toBeNull();
      expect(typeof result.restore.note).toBe("string");
      expect(
        poemsState.calls.filter((call) => call.startsWith("readHistory")),
      ).toEqual([]);
    }

    expect(poemsState.calls.join()).not.toContain("writeFile");
  });

  it("does not dress a version it cannot read as a version that is gone, and does not stop the editor page over it", async () => {
    const result = await loadPage({
      search: "?restore=1&restoreVersion=404404404&restoreScope=legacy",
    });

    // The seam already named this one, as an HTTP refusal: `MissingSnapshotError` never reaches a page.
    expect(result.restore.open).toBe(true);
    expect(result.restore.target).toBeNull();
    expect(result.restore.note).toContain("could not be read");
    expect(consoleError).not.toHaveBeenCalled();
    expect(poemsState.writes).toEqual([]);
  });

  it("says out loud, and into the log, when a version cannot be read because the store is not answering", async () => {
    poemsState.outages = { [`legacy:${RESTORED_VERSION}`]: OUTAGE };

    const result = await loadPage({
      search: `?restore=1&restoreVersion=${RESTORED_VERSION}&restoreScope=legacy`,
    });

    expect(result.restore.open).toBe(true);
    expect(result.restore.target).toBeNull();
    expect(result.restore.note).toContain("could not be read");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(poemsState.writes).toEqual([]);
  });
});

describe("the poems restore action", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    poemsState.calls.length = 0;
    poemsState.writes.length = 0;
    poemsState.draftText = DRAFT_TEXT;
    poemsState.snapshots = { [`legacy:${RESTORED_VERSION}`]: SNAPSHOT_TEXT };
    poemsState.outages = {};

    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores one poem into the draft, protecting the draft it is about to replace first", async () => {
    const before = Date.now();

    await expect(runRestore({ form: formForRestore() })).rejects.toMatchObject({
      status: 303,
      location: `/poems/edit/19/ooo?restored=${RESTORED_VERSION}&entry=19&scope=legacy`,
    });

    const after = Date.now();

    expect(poemsState.calls).toEqual([
      "readFile:poems:draft",
      `readHistory:poems:${RESTORED_VERSION}:legacy`,
      "baseline:poems:draft",
      "writeFile:poems:draft",
    ]);
    expect(poemsState.writes.map((write) => write.scope)).toEqual(["draft"]);

    const written = poemsState.writes[0];
    expect(written && writtenPoemIds(written.file)).toEqual([2, 4, 19]);

    // The draft is written with the time the restore happened - not the version number the poem was restored
    // from, and not the version number the form handed through for T9 to use either. The draft the editor is
    // shown is the draft that was just written, and its timestamp is what the next save will compare against.
    const writtenTimestamp = (written?.file as { timestamp: number }).timestamp;

    expect(writtenTimestamp).not.toBe(RESTORED_VERSION);
    expect(writtenTimestamp).not.toBe(1000);
    expect(writtenTimestamp).toBeGreaterThanOrEqual(before);
    expect(writtenTimestamp).toBeLessThanOrEqual(after);
  });

  it("restores into the draft and never into live, whatever tier the version came out of", async () => {
    await expect(
      runRestore({ form: formForRestore({ entryId: "4" }) }),
    ).rejects.toMatchObject({ status: 303 });

    expect(poemsState.writes.map((write) => write.scope)).toEqual(["draft"]);
    expect(poemsState.calls.some((call) => call.includes(":live"))).toBe(false);
  });

  it("refuses a form whose tier, version or entry id it cannot trust before asking the store for anything", async () => {
    for (const form of [
      formForRestore({ scope: "draft;DROP TABLE poems" }),
      formForRestore({ scope: "" }),
      formForRestore({ timestamp: "abc" }),
      formForRestore({ timestamp: "1e9" }),
      formForRestore({ timestamp: "" }),
      formForRestore({ entryId: "0" }),
      formForRestore({ entryId: "-19" }),
      formForRestore({ entryId: "19.5" }),
      formForRestore({ entryId: "" }),
    ]) {
      poemsState.calls.length = 0;

      await expect(runRestore({ form })).rejects.toMatchObject({
        status: 303,
        location: REFUSAL_LOCATION,
      });

      expect(poemsState.calls).toEqual([]);
      expect(poemsState.writes).toEqual([]);
    }
  });

  it("writes nothing when the version it was sent is not held in the tier it was named in", async () => {
    poemsState.snapshots = {};

    await expect(runRestore({ form: formForRestore() })).rejects.toMatchObject({
      status: 303,
      location: REFUSAL_LOCATION,
    });

    expect(poemsState.calls).toEqual([
      "readFile:poems:draft",
      `readHistory:poems:${RESTORED_VERSION}:legacy`,
    ]);
    expect(poemsState.writes).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("writes nothing when the version it was sent is not a poems file", async () => {
    poemsState.snapshots = {
      [`legacy:${RESTORED_VERSION}`]: BAD_SNAPSHOT_TEXT,
    };

    await expect(runRestore({ form: formForRestore() })).rejects.toMatchObject({
      status: 303,
      location: REFUSAL_LOCATION,
    });

    expect(poemsState.calls).toEqual([
      "readFile:poems:draft",
      `readHistory:poems:${RESTORED_VERSION}:legacy`,
    ]);
    expect(poemsState.writes).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("writes nothing when there is no draft to restore into, and does not invent one", async () => {
    poemsState.draftText = undefined;

    await expect(runRestore({ form: formForRestore() })).rejects.toMatchObject({
      status: 303,
      location: REFUSAL_LOCATION,
    });

    // The draft read is the first thing the seam asks for, which is what makes this the cheapest failure to
    // catch: it happens before a version is read and before a baseline is filed.
    expect(poemsState.calls).toEqual(["readFile:poems:draft"]);
    expect(poemsState.writes).toEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the version it was sent never held that poem", async () => {
    poemsState.snapshots = {
      [`legacy:${RESTORED_VERSION}`]: JSON.stringify({
        name: "poems",
        timestamp: RESTORED_VERSION,
        data: {
          data: [
            {
              id: 7,
              attributes: {
                createdAt: "2021-01-07T00:00:00.000Z",
                updatedAt: "2021-01-07T00:00:00.000Z",
                publishedAt: "2021-01-07T00:00:00.000Z",
                title: "Something else entirely",
                body: "a version holding a different poem",
                featured: false,
                position: 70,
              },
            },
          ],
          meta: {
            pagination: { page: 1, pageCount: 1, pageSize: 25, total: 1 },
          },
        },
      }),
    };

    await expect(runRestore({ form: formForRestore() })).rejects.toMatchObject({
      status: 303,
      location: REFUSAL_LOCATION,
    });

    // Everything the merge needs happened - including the baseline - and still nothing was written.
    expect(poemsState.calls).toEqual([
      "readFile:poems:draft",
      `readHistory:poems:${RESTORED_VERSION}:legacy`,
      "baseline:poems:draft",
    ]);
    expect(poemsState.writes).toEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the store is not answering, and does not call an outage a missing version", async () => {
    poemsState.outages = { [`legacy:${RESTORED_VERSION}`]: OUTAGE };

    await expect(runRestore({ form: formForRestore() })).rejects.toMatchObject({
      status: 303,
      location: REFUSAL_LOCATION,
    });

    expect(poemsState.writes).toEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe("the line the poems editor shows after a restore", () => {
  beforeEach(() => {
    poemsState.calls.length = 0;
    poemsState.writes.length = 0;
    poemsState.snapshots = { [`legacy:${RESTORED_VERSION}`]: SNAPSHOT_TEXT };
    poemsState.outages = {};
    poemsState.entries = VERSION_ENTRIES;

    vi.resetModules();
  });

  it("says which poem came back and which version it came out of", async () => {
    poemsState.draftText = DRAFT_AFTER_RESTORE_TEXT;

    const result = await loadPage({
      search: `?restored=${RESTORED_VERSION}&entry=19&scope=legacy`,
      pathname: "/poems/edit/19/ooo",
      pid: "19/ooo",
    });

    expect(result.savedTitle).toBe("Restore complete");
    expect(result.savedMessage).toBe(
      'Restored "Ooo" from the version saved 25 October 2026 at 03:46 (pre-S3 copy).',
    );
  });

  it("names the published version a restored poem was put back from, in a draft that is being restored to", async () => {
    poemsState.draftText = DRAFT_TEXT;

    const result = await loadPage({
      search: "?restored=1790025623841&entry=4&scope=live",
    });

    expect(result.savedMessage).toBe(
      'Restored "The Carpal Tunnel" from the version saved 21 September 2026 at 21:20 (published version).',
    );
  });

  it("refuses out loud when a restore failed, without naming a poem it did not restore", async () => {
    const result = await loadPage({ search: "?restore-failed=1" });

    expect(result.savedTitle).toBe("Nothing restored");
    expect(result.savedMessage).toBe(
      "Nothing was restored: that version could not be read, or no longer holds that poem. Your current draft is unchanged.",
    );
    expect(
      poemsState.calls.filter((call) => call.startsWith("readHistory")),
    ).toEqual([]);
    expect(poemsState.writes).toEqual([]);
  });

  it("says nothing at all about a ?restored link it cannot read, instead of guessing which way it went", async () => {
    const result = await loadPage({
      search: "?restored=soon&entry=19&scope=legacy",
    });

    expect(result.savedTitle).toBeNull();
    expect(result.savedMessage).toBeNull();
  });
});

describe("the picker, rendered", () => {
  const versionItem = {
    timestamp: RESTORED_VERSION,
    scope: "legacy",
    dateLabel: "25 October 2026 at 03:46",
    tierLabel: "(pre-S3 copy)",
    href: `${EDITOR_PATH}?restore=1&restoreVersion=${RESTORED_VERSION}&restoreScope=legacy`,
  };

  it("keeps the paragraph a call site passes as message when it passes no children of its own", () => {
    render(UnsavedChangesDialog, {
      props: {
        open: true,
        title: "Delete this poem?",
        message:
          "This removes the poem from the live site. A history snapshot is retained so it can be restored later.",
        stayLabel: "Cancel",
        leaveLabel: "Delete",
        onStay: () => undefined,
        onLeave: () => undefined,
      },
    });

    expect(
      screen.getByText(
        "This removes the poem from the live site. A history snapshot is retained so it can be restored later.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders the caller's own body in place of that paragraph when a snippet is passed to it", () => {
    render(UnsavedChangesDialog, {
      props: {
        open: true,
        title: "Restore a saved version",
        message: "This paragraph is not what the picker shows.",
        children: createRawSnippet(() => ({
          render: () => "<p>the picker's own body</p>",
        })),
      },
    });

    expect(screen.getByText("the picker's own body")).toBeInTheDocument();
    expect(
      screen.queryByText("This paragraph is not what the picker shows."),
    ).not.toBeInTheDocument();
  });

  it("marks a saved poem the draft still holds as a replacement, and one it lost as a bring-back", () => {
    render(HistoryDialog, {
      props: {
        open: true,
        versions: [versionItem],
        target: {
          ...versionItem,
          entries: [
            { id: 4, title: "The Carpal Tunnel as it was", willReplace: true },
            { id: 19, title: "Ooo", willReplace: false },
          ],
        },
        actionHref: `${EDITOR_PATH}?/restore`,
        versionsHref: `${EDITOR_PATH}?restore=1`,
        closeHref: EDITOR_PATH,
        draftVersion: 1000,
      },
    });

    expect(screen.getByText("will replace")).toBeInTheDocument();
    expect(
      screen.getByText("will bring back (deleted since)"),
    ).toBeInTheDocument();
    // The version the entries came out of is named in the dialog's own headline.
    expect(
      screen.getByText(/Restore one poem from the version saved/),
    ).toBeInTheDocument();
  });

  it("posts the tier, the version and the entry it was asked for, and hands the draft's own version through unused", () => {
    render(HistoryDialog, {
      props: {
        open: true,
        versions: [versionItem],
        target: {
          ...versionItem,
          entries: [{ id: 19, title: "Ooo", willReplace: false }],
        },
        actionHref: `${EDITOR_PATH}?/restore`,
        versionsHref: `${EDITOR_PATH}?restore=1`,
        closeHref: EDITOR_PATH,
        draftVersion: 1000,
      },
    });

    const form = document.querySelector("form");
    const value = (name: string) =>
      form?.querySelector(`input[name="${name}"]`)?.getAttribute("value");

    expect(form?.getAttribute("method")).toBe("POST");
    expect(form?.getAttribute("action")).toBe(`${EDITOR_PATH}?/restore`);
    expect(value("scope")).toBe("legacy");
    expect(value("timestamp")).toBe(String(RESTORED_VERSION));
    expect(value("entryId")).toBe("19");
    // Carried through the form for T9 to use, and unread by the restore that receives it today.
    expect(value("draftVersion")).toBe("1000");
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("lists five versions max, each one a link to its own version and tier, with a live version called a published version", () => {
    render(HistoryDialog, {
      props: {
        open: true,
        versions: [
          versionItem,
          {
            ...versionItem,
            timestamp: 1790025623841,
            scope: "live",
            tierLabel: "(published version)",
            dateLabel: "21 September 2026 at 21:20",
            href: `${EDITOR_PATH}?restore=1&restoreVersion=1790025623841&restoreScope=live`,
          },
        ],
        target: null,
        actionHref: `${EDITOR_PATH}?/restore`,
        versionsHref: `${EDITOR_PATH}?restore=1`,
        closeHref: EDITOR_PATH,
        draftVersion: 1000,
      },
    });

    const links = [...document.querySelectorAll<HTMLAnchorElement>("li a")];
    const hrefs = links
      .map((link) => link.getAttribute("href"))
      .filter(Boolean);

    expect(hrefs).toHaveLength(2);
    expect(hrefs).toContain(versionItem.href);
    expect(
      hrefs.some((href) =>
        href.includes("restoreVersion=1790025623841&restoreScope=live"),
      ),
    ).toBe(true);
    expect(screen.getByText("(published version)")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore" }),
    ).not.toBeInTheDocument();
  });

  it("says which version it could not read, instead of showing an empty list of entries", () => {
    render(HistoryDialog, {
      props: {
        open: true,
        versions: [versionItem],
        target: null,
        note: "That version could not be read. Pick a version from the list below - nothing has been written to your draft.",
        actionHref: `${EDITOR_PATH}?/restore`,
        versionsHref: `${EDITOR_PATH}?restore=1`,
        closeHref: EDITOR_PATH,
        draftVersion: 1000,
      },
    });

    expect(screen.getByText(/could not be read/)).toBeInTheDocument();
  });

  it("keeps a saved copy with no usable id out of the forms a restore posts", () => {
    render(HistoryDialog, {
      props: {
        open: true,
        versions: [versionItem],
        target: {
          ...versionItem,
          entries: [{ id: 0, title: "Ooo", willReplace: false }],
        },
        actionHref: `${EDITOR_PATH}?/restore`,
        versionsHref: `${EDITOR_PATH}?restore=1`,
        closeHref: EDITOR_PATH,
        draftVersion: 1000,
      },
    });

    expect(document.querySelector("form")).toBeNull();
    expect(
      screen.getByText("this saved copy carries no id a restore can use"),
    ).toBeInTheDocument();
  });
});

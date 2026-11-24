import { describe, it, expect, beforeEach, vi } from "vitest";
import { isHttpError } from "@sveltejs/kit";
import { Schema } from "effect";

import { createJsonEditorStore } from "#lib/editing/core/store.server";
import { MissingSnapshotError } from "#lib/dataStore.server";
import type { DataStore, HistoryEntry } from "#lib/dataStore.server";

/**
 * Card T5 — the restore seam.
 *
 * These run against a fake `DataStore` built out of `vi.fn()`s rather than against a bucket or a disk,
 * because the two things worth proving here are not payloads, they are *decisions and their order*: which
 * tier a read goes to, which tier a write is allowed to land in, and whether the copy of the current draft
 * exists before the new draft replaces it. A store double that records its own call order is what makes the
 * ordering rule testable instead of documentable.
 */

// ------------------------------------------------------------------ the fake store

type FakeState = {
  /** The JSON text a draft read answers. `undefined` means "this key has no draft yet". */
  draftText?: string;
  snapshotText?: string;
  snapshotError?: Error;
  baselineCreated: boolean;
  entries: HistoryEntry[];
  /** Every store method records itself here, in the order it was called. */
  calls: string[];
  writes: Array<{ name: string; scope: string; file: unknown }>;
};

const makeState = (overrides: Partial<FakeState> = {}): FakeState => ({
  baselineCreated: true,
  entries: [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 900, scope: "live" },
    { timestamp: 700, scope: "legacy" },
  ],
  calls: [],
  writes: [],
  ...overrides,
});

/**
 * The two stores' shared vocabulary, expressed as call names: `readHistory:poems:700:legacy` says which
 * key, which version and which tier, which is exactly what a restore can get wrong while every value it
 * writes still looks correct.
 */
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

    // The same rule both stores actually follow: a snapshot of a draft that is not there is not created,
    // and a failure to snapshot is not an error a save has to obey.
    return state.draftText === undefined ? false : state.baselineCreated;
  }),
  release: vi.fn(async (name) => {
    state.calls.push(`release:${name}`);

    return 1;
  }),
  listHistory: vi.fn(async (name, options) => {
    state.calls.push(`listHistory:${name}:${options?.scope ?? "all"}`);

    return state.entries;
  }),
  readHistory: vi.fn(async (name, timestamp, scope) => {
    const scoped = scope ?? "draft";
    state.calls.push(`readHistory:${name}:${timestamp}:${scoped}`);

    if (state.snapshotError) throw state.snapshotError;

    if (state.snapshotText === undefined) {
      throw new MissingSnapshotError(name, timestamp, scoped);
    }

    return state.snapshotText;
  }),
});

const makeFake = (overrides: Partial<FakeState> = {}) => {
  const state = makeState(overrides);

  return { store: makeFakeStore(state), state };
};

/**
 * The same double over a state object the caller owns, for the poems wiring tests: `poems.server.ts` builds
 * its store once, at import, so its fake has to outlive each test while the text it answers with does not.
 */
const makeSharedFake = (state: FakeState) => makeFakeStore(state);

// ------------------------------------------------------------- the seam under test

const testFileC = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: Schema.Struct({
    lines: Schema.Array(
      Schema.Struct({ id: Schema.Number, text: Schema.String }),
    ),
  }),
});

// Derived from the schema rather than written out beside it, which is what `src/lib/typing/poem.ts` does for
// the same reason: an output type spelled by hand is assignable to a `Schema.Struct` output only when its
// variances line up exactly, and this is the one place in the test where that would be a svelte-check error.
type TestFile = Schema.Schema.Type<typeof testFileC>;

const INVALID_MESSAGE = "Invalid test data file.";

const DRAFT_TEXT = JSON.stringify({
  name: "poems",
  timestamp: 1000,
  data: {
    lines: [
      { id: 1, text: "the body the draft has now" },
      { id: 2, text: "leave this one alone" },
    ],
  },
});

const SNAPSHOT_TEXT = JSON.stringify({
  name: "poems",
  timestamp: 500,
  data: { lines: [{ id: 1, text: "the body an editor overwrote" }] },
});

const NOW = new Date("2026-03-01T00:00:00.000Z");

const makeSeam = (store: DataStore) =>
  createJsonEditorStore<TestFile>({
    store,
    schema: testFileC,
    contentKey: "poems",
    invalidDataMessage: INVALID_MESSAGE,
  });

/** A merge in the shape the resources use: replace one entry, keep the rest. */
const mergeLine = (
  snapshotFile: TestFile,
  currentFile: TestFile,
  entryId: number,
): TestFile => {
  const held = snapshotFile.data.lines.find((line) => line.id === entryId);
  const others = currentFile.data.lines.filter((line) => line.id !== entryId);

  return {
    ...currentFile,
    data: { lines: held ? [...others, held] : others },
  };
};

const order = (calls: string[], needle: string) =>
  calls.findIndex((call) => call.startsWith(needle));

describe("the restore seam", () => {
  describe("offering versions", () => {
    it("asks for every tier with a cap, and hands back the tiers the store found", async () => {
      const { store, state } = makeFake();

      const entries = await makeSeam(store).listHistoryVersions();

      expect(entries).toEqual([
        { timestamp: 1000, scope: "draft" },
        { timestamp: 900, scope: "live" },
        { timestamp: 700, scope: "legacy" },
      ]);
      // `all` is what makes a legacy snapshot visible at all, and the cap is what keeps a five-row version
      // picker from listing a key's whole history: the store's own default is 100.
      expect(state.calls).toEqual(["listHistory:poems:all"]);
      expect(store.listHistory).toHaveBeenCalledWith("poems", {
        scope: "all",
        limit: 5,
      });
    });

    it("lets a screen ask for a different number of versions", async () => {
      const { store } = makeFake();

      await makeSeam(store).listHistoryVersions(2);

      expect(store.listHistory).toHaveBeenCalledWith("poems", {
        scope: "all",
        limit: 2,
      });
    });
  });

  describe("reading one saved version", () => {
    it("reads a legacy version out of the legacy tier it was listed under", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      const snapshot = await makeSeam(store).readSnapshot("legacy", 700);

      expect(snapshot.data.lines).toEqual([
        { id: 1, text: "the body an editor overwrote" },
      ]);
      // `readHistory` defaults to draft. A version listed as legacy and then read with the default scope is
      // a guaranteed miss, so the scope has to travel with it.
      expect(state.calls).toEqual(["readHistory:poems:700:legacy"]);
    });

    it("refuses a version that is not there as a 500, not as an internal throw", async () => {
      const { store, state } = makeFake({ draftText: DRAFT_TEXT });

      const cause = await makeSeam(store)
        .readSnapshot("legacy", 700)
        .then(
          () => undefined,
          (err: unknown) => err,
        );

      expect(isHttpError(cause)).toBe(true);
      // AGENTS.md fact 6: `e500` carries `status` and `body`, never a `message` property, so the assertion
      // reads `body.message` and `status` and never the one key that is not there.
      expect((cause as { status: number }).status).toBe(500);
      expect((cause as { body: { message: string } }).body.message).toContain(
        "version 700 is not held in legacy history",
      );
      expect(state.calls).toEqual(["readHistory:poems:700:legacy"]);
    });

    it("refuses a snapshot whose JSON is not this resource's shape, and writes nothing", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: JSON.stringify({
          name: "poems",
          timestamp: 700,
          data: { lines: [{ nope: 1 }] },
        }),
      });

      const cause = await makeSeam(store)
        .restoreWholeRecord("legacy", 700, NOW)
        .then(
          () => undefined,
          (err: unknown) => err,
        );

      expect(isHttpError(cause)).toBe(true);
      expect((cause as { status: number }).status).toBe(500);
      expect((cause as { body: { message: string } }).body.message).toBe(
        INVALID_MESSAGE,
      );
      // Nothing written, and nothing snapshotted on the way to a write that never happened.
      expect(state.writes).toEqual([]);
      expect(state.calls).not.toContainEqual(
        expect.stringMatching(/^writeFile/),
      );
    });

    it("refuses a snapshot it cannot even parse with the same message, instead of a SyntaxError", async () => {
      const { store } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: "{ not json at all",
      });

      const cause = await makeSeam(store)
        .readSnapshot("draft", 700)
        .then(
          () => undefined,
          (err: unknown) => err,
        );

      expect(isHttpError(cause)).toBe(true);
      expect((cause as { body: { message: string } }).body.message).toBe(
        INVALID_MESSAGE,
      );
    });

    it("leaves a store outage an outage instead of calling it a version that is gone", async () => {
      const outage = new Error("the bucket is unreachable");
      const { store } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotError: outage,
      });

      const cause = await makeSeam(store)
        .readSnapshot("legacy", 700)
        .then(
          () => undefined,
          (err: unknown) => err,
        );

      expect(cause).toBe(outage);
      expect(isHttpError(cause)).toBe(false);
    });
  });

  describe("restoring the whole record", () => {
    it("snapshots the current draft before it writes the new one, in that order", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      await makeSeam(store).restoreWholeRecord("legacy", 700, NOW);

      // Exact call order, on purpose. If a restore wrote the draft before the copy of the old draft
      // existed, the feature would have destroyed the very thing it exists to protect - and swapping these
      // two lines is the only way this test can fail.
      expect(state.calls).toEqual([
        "readHistory:poems:700:legacy",
        "baseline:poems:draft",
        "writeFile:poems:draft",
      ]);
      expect(order(state.calls, "baseline")).toBeLessThan(
        order(state.calls, "writeFile"),
      );
    });

    it("writes the snapshot's data as a fresh draft, under the current key", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      const restored = await makeSeam(store).restoreWholeRecord(
        "legacy",
        700,
        NOW,
      );

      expect(state.writes).toHaveLength(1);
      const written = state.writes[0];
      expect(written?.scope).toBe("draft");
      expect(written?.name).toBe("poems");
      expect((written?.file as TestFile).data).toEqual(SNAPSHOT_LEGACY_DATA);
      expect((written?.file as TestFile).timestamp).toBe(NOW.getTime());
      expect(restored.timestamp).toBe(NOW.getTime());
    });

    it("restores a live version into the draft and never writes live", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      await makeSeam(store).restoreWholeRecord("live", 700, NOW);

      expect(state.calls).toEqual([
        "readHistory:poems:700:live",
        "baseline:poems:draft",
        "writeFile:poems:draft",
      ]);
      expect(state.writes.map((write) => write.scope)).toEqual(["draft"]);
      // A live snapshot may only be read *into* the draft. Releasing stays an explicit act a caller has to
      // ask for, and a release at least snapshots the copy it replaces.
      expect(store.release).not.toHaveBeenCalled();
      expect(
        state.calls.some((call) => call.includes(":live")) &&
          state.writes.every((write) => write.scope !== "live"),
      ).toBe(true);
    });

    it("restores even when the store says it snapshotted nothing, because the draft it replaces is already in history", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
        baselineCreated: false,
      });

      await makeSeam(store).restoreWholeRecord("draft", 1000, NOW);

      expect(state.writes).toHaveLength(1);
      // `ensureBaselineSnapshot` resolves `false` for three different states - nothing to protect, a copy
      // already filed under the draft's own timestamp, and a snapshot that failed. Both stores write a
      // history copy of every file `writeFile` writes, so the superseded draft is already recoverable from
      // its own timestamp: refusing a restore on `false` would refuse the ordinary case.
      expect(state.baselineCreated).toBe(false);
    });
  });

  describe("restoring one entry", () => {
    it("reads the current draft, snapshots it, then writes - in that order", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      await makeSeam(store).restoreEntry(
        "legacy",
        700,
        1,
        ({ snapshotFile, currentFile, entryId }) =>
          mergeLine(snapshotFile, currentFile, entryId),
        NOW,
      );

      expect(state.calls).toEqual([
        "readFile:poems:draft",
        "readHistory:poems:700:legacy",
        "baseline:poems:draft",
        "writeFile:poems:draft",
      ]);
    });

    it("keeps the entries the snapshot was not asked for", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      await makeSeam(store).restoreEntry(
        "legacy",
        700,
        1,
        ({ snapshotFile, currentFile, entryId }) =>
          mergeLine(snapshotFile, currentFile, entryId),
        NOW,
      );

      const written = state.writes[0]?.file as TestFile;

      expect(written.data.lines).toEqual([
        { id: 2, text: "leave this one alone" },
        { id: 1, text: "the body an editor overwrote" },
      ]);
      expect(written.timestamp).toBe(NOW.getTime());
    });

    it("writes nothing when the merge refuses the entry, and says why", async () => {
      const { store, state } = makeFake({
        draftText: DRAFT_TEXT,
        snapshotText: SNAPSHOT_TEXT,
      });

      const cause = await makeSeam(store)
        .restoreEntry(
          "legacy",
          700,
          99,
          ({ entryId }) => {
            throw new Error(`no entry ${entryId} in this version`);
          },
          NOW,
        )
        .then(
          () => undefined,
          (err: unknown) => err,
        );

      expect((cause as Error).message).toContain("no entry 99");
      // A merge that refuses loudly is the resource saying "there is nothing here to restore". The seam
      // still has to honour that by never reaching its write.
      expect(state.writes).toEqual([]);
      expect(state.calls.some((call) => call.startsWith("writeFile"))).toBe(
        false,
      );
    });
  });

  describe("when the key has no draft yet", () => {
    it("asks the store for a baseline it cannot make, gets `false`, and still restores the record", async () => {
      const { store, state } = makeFake({
        draftText: undefined,
        snapshotText: SNAPSHOT_TEXT,
      });

      const restored = await makeSeam(store).restoreWholeRecord(
        "legacy",
        700,
        NOW,
      );

      // No phantom snapshot of a draft that does not exist, and no refusal either: with nothing current
      // there is nothing to protect, so restoring an old whole record is just a draft appearing.
      expect(state.calls).toEqual([
        "readHistory:poems:700:legacy",
        "baseline:poems:draft",
        "writeFile:poems:draft",
      ]);
      expect(state.writes).toHaveLength(1);
      expect(restored.data.lines).toEqual([
        { id: 1, text: "the body an editor overwrote" },
      ]);
    });

    it("refuses a per-entry restore and writes nothing, because there is nothing to restore it into", async () => {
      const { store, state } = makeFake({
        draftText: undefined,
        snapshotText: SNAPSHOT_TEXT,
      });

      const cause = await makeSeam(store)
        .restoreEntry(
          "legacy",
          700,
          1,
          ({ snapshotFile, currentFile, entryId }) =>
            mergeLine(snapshotFile, currentFile, entryId),
          NOW,
        )
        .then(
          () => undefined,
          (err: unknown) => err,
        );

      expect((cause as Error).message).toBe("ENOENT");
      expect(state.writes).toEqual([]);
      expect(state.calls).toEqual(["readFile:poems:draft"]);
      // A draft built from one entry out of nowhere is a whole-record replacement wearing the words "one
      // entry", and a release of it would wipe every other entry out of live.
      expect(store.writeFile).not.toHaveBeenCalled();
      expect(store.ensureBaselineSnapshot).not.toHaveBeenCalled();
    });
  });
});

// The snapshot's own payload, spelled out so "the restored payload is the snapshot's data" is an assertion
// about data and not about whatever the seam happened to keep.
const SNAPSHOT_LEGACY_DATA = {
  lines: [{ id: 1, text: "the body an editor overwrote" }],
};

// -------------------------------------------------- the poems wiring, through the same seam

/**
 * `poems.server.ts` builds its store at module-load time, so the store a poems module reads through is
 * decided by `contentDataStore()`. Replacing only that one function - with the real module still in place
 * under it - is what lets these tests check the wiring without touching the bucket or the disk.
 */
const poemsDraftText = JSON.stringify({
  name: "poems",
  timestamp: 1000,
  data: {
    data: [
      {
        id: 3,
        attributes: {
          createdAt: "2024-01-03T00:00:00.000Z",
          updatedAt: "2024-01-03T00:00:00.000Z",
          publishedAt: "2024-01-03T00:00:00.000Z",
          title: "Keeper",
          body: "leave this poem exactly as it is",
          featured: false,
          position: 30,
        },
      },
      {
        id: 2,
        attributes: {
          createdAt: "2023-01-02T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
          publishedAt: "2023-01-02T00:00:00.000Z",
          title: "Current two",
          body: "the body a later editor wrote over the old one",
          featured: false,
          position: 20,
        },
      },
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 2 } },
  },
});

const poemsSnapshotText = JSON.stringify({
  name: "poems",
  timestamp: 700,
  data: {
    data: [
      {
        id: 2,
        attributes: {
          createdAt: "2022-01-02T00:00:00.000Z",
          updatedAt: "2022-06-06T00:00:00.000Z",
          publishedAt: "2022-01-02T00:00:00.000Z",
          title: "Poem two as it was",
          body: "the body this version had",
          featured: true,
          position: 20,
        },
      },
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 1 } },
  },
});

const poemsState = {
  draftText: poemsDraftText,
  snapshotText: poemsSnapshotText,
  baselineCreated: true,
  entries: [
    { timestamp: 1000, scope: "draft" },
    { timestamp: 700, scope: "legacy" },
  ] as HistoryEntry[],
  calls: [] as string[],
  writes: [] as Array<{ name: string; scope: string; file: unknown }>,
};

vi.mock("#lib/content.server", async () => {
  const actual = await vi.importActual<typeof import("#lib/content.server")>(
    "#lib/content.server",
  );

  return {
    ...actual,
    contentDataStore: () => makeSharedFake(poemsState),
  };
});

describe("the poems wiring", () => {
  let poems: typeof import("#lib/editing/resources/poems/poems.server");

  beforeEach(async () => {
    poemsState.calls.length = 0;
    poemsState.writes.length = 0;
    poemsState.draftText = poemsDraftText;
    poemsState.snapshotText = poemsSnapshotText;

    vi.resetModules();
    poems = await import("#lib/editing/resources/poems/poems.server");
  });

  it("lists the versions a restore screen offers, with the legacy tier visible", async () => {
    const entries = await poems.listPoemEditorHistoryVersions();

    expect(entries).toEqual([
      { timestamp: 1000, scope: "draft" },
      { timestamp: 700, scope: "legacy" },
    ]);
    expect(poemsState.calls).toEqual(["listHistory:poems:all"]);
  });

  it("reads one saved version's poems in the editor's own entry shape", async () => {
    const values = await poems.readPoemEditorSnapshotEntries("legacy", 700);

    expect(values).toEqual([
      {
        id: 2,
        title: "Poem two as it was",
        bodyMarkdown: "the body this version had",
        sortOrder: 20,
      },
    ]);
    // The picker has to be given the entry ids and positions a snapshot held, in the same shape the editor
    // already knows how to render, and the legacy scope has to be passed explicitly.
    expect(poemsState.calls).toEqual(["readHistory:poems:700:legacy"]);
  });

  it("restores one poem into the draft and leaves the other poem alone", async () => {
    await poems.restorePoemEditorEntryFromSnapshot({
      scope: "legacy",
      timestamp: 700,
      poemId: 2,
      now: NOW,
    });

    expect(poemsState.calls).toEqual([
      "readFile:poems:draft",
      "readHistory:poems:700:legacy",
      "baseline:poems:draft",
      "writeFile:poems:draft",
    ]);

    const written = poemsState.writes[0]?.file as {
      name: string;
      timestamp: number;
      data: {
        data: Array<{
          id: number;
          attributes: { title: string; body: string; featured: boolean };
        }>;
      };
    };

    expect(written.data.data.map((item) => item.id)).toEqual([2, 3]);
    expect(written.data.data[0]?.attributes).toEqual({
      createdAt: "2022-01-02T00:00:00.000Z",
      updatedAt: "2022-06-06T00:00:00.000Z",
      publishedAt: "2022-01-02T00:00:00.000Z",
      title: "Poem two as it was",
      body: "the body this version had",
      featured: true,
      position: 20,
    });
    expect(written.data.data[1]?.attributes.body).toBe(
      "leave this poem exactly as it is",
    );
    expect(written.timestamp).toBe(NOW.getTime());
  });

  it("refuses a restore into a key that has no draft, without writing one", async () => {
    poemsState.draftText = undefined;

    const cause = await poems
      .restorePoemEditorEntryFromSnapshot({
        scope: "legacy",
        timestamp: 700,
        poemId: 2,
        now: NOW,
      })
      .then(
        () => undefined,
        (err: unknown) => err,
      );

    expect((cause as Error).message).toBe("ENOENT");
    expect(poemsState.writes).toEqual([]);
  });
});

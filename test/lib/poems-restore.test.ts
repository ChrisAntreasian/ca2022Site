import { describe, it, expect } from "vitest";

import {
  restorePoemEntryFromSnapshot,
  type PoemsFile,
} from "#lib/editing/resources/poems/poems";

/**
 * Card T5 — the poems rule behind `restoreEntry`'s `merge` argument.
 *
 * `restoreEntry` in the seam owns the ordering (a copy of the current draft, then a new draft). What it does
 * *not* own is what "restore poem 27" means for a poems file, and that is a poems question: which copy is
 * the poem's, which poems may not be touched, and what may not be re-stamped. Those live here, and this
 * file tests them through the poems helper alone — no store, no bucket, no disk.
 */

const NOW = new Date("2026-03-01T00:00:00.000Z");

const poem = (
  id: number,
  title: string,
  body: string,
  overrides: Partial<PoemsFile["data"]["data"][number]["attributes"]> = {},
): PoemsFile["data"]["data"][number] => ({
  id,
  attributes: {
    createdAt: "2022-01-01T00:00:00.000Z",
    updatedAt: "2022-01-01T00:00:00.000Z",
    publishedAt: "2022-01-01T00:00:00.000Z",
    title,
    body,
    featured: false,
    position: id,
    ...overrides,
  },
});

/**
 * A current draft held with the entries in descending id order on purpose: a poems array's index is not its
 * display order (`toPoemEditorValues` sorts by `position`), and a test that assumed index order would look
 * at the wrong thing.
 */
const currentFile = (): PoemsFile => ({
  name: "poems",
  timestamp: 1000,
  data: {
    data: [
      poem(3, "Newer keeper", "kept exactly as it is", {
        createdAt: "2024-01-03T00:00:00.000Z",
        updatedAt: "2024-01-03T00:00:00.000Z",
        publishedAt: "2024-01-03T00:00:00.000Z",
        position: 30,
      }),
      poem(2, "Poem two current", "the body a later save wrote over it", {
        createdAt: "2023-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        publishedAt: "2023-01-02T00:00:00.000Z",
        position: 20,
      }),
      poem(1, "Poem one", "one", {
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
        publishedAt: "2023-01-01T00:00:00.000Z",
        position: 10,
      }),
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 3 } },
  },
});

/** Version 700: the three poems as they were, plus a fourth a later save deleted. */
const snapshotFile = (): PoemsFile => ({
  name: "poems",
  timestamp: 700,
  data: {
    data: [
      poem(1, "Poem one as it was", "the body this version had", {
        createdAt: "2022-02-01T00:00:00.000Z",
        updatedAt: "2022-06-06T00:00:00.000Z",
        publishedAt: "2022-02-01T00:00:00.000Z",
        featured: true,
        position: 10,
      }),
      poem(
        7,
        "Poem seven, deleted since",
        "an entry nothing in the draft holds",
        {
          createdAt: "2022-03-01T00:00:00.000Z",
          updatedAt: "2022-07-07T00:00:00.000Z",
          publishedAt: "2022-03-01T00:00:00.000Z",
          position: 15,
        },
      ),
      poem(2, "Poem two as it was", "what poem two used to say", {
        createdAt: "2022-04-01T00:00:00.000Z",
        updatedAt: "2022-08-08T00:00:00.000Z",
        publishedAt: "2022-04-01T00:00:00.000Z",
        position: 20,
      }),
    ],
    meta: { pagination: { page: 1, pageCount: 1, pageSize: 25, total: 3 } },
  },
});

const ids = (file: PoemsFile) => file.data.data.map((item) => item.id);
const find = (file: PoemsFile, id: number) =>
  file.data.data.find((item) => item.id === id);

describe("restoring one poem out of a saved version", () => {
  it("replaces the restored entry with the version's own copy of it", () => {
    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshotFile(),
      currentFile: currentFile(),
      poemId: 1,
      now: NOW,
    });

    const item = find(restored, 1);

    // "The snapshot's copy, all of it": `featured` is true in the version and false in the draft, and the
    // restored entry takes the version's. Hand-picking fields would restore a poem that looks like an old
    // one in some places and like today's in others.
    expect(item?.attributes).toEqual({
      createdAt: "2022-02-01T00:00:00.000Z",
      updatedAt: "2022-06-06T00:00:00.000Z",
      publishedAt: "2022-02-01T00:00:00.000Z",
      title: "Poem one as it was",
      body: "the body this version had",
      featured: true,
      position: 10,
    });
    // A poem keeps the id it was saved with. Two poems in the same file holding the same id is not a shape
    // this app can render, and the version's id is the only handle the editor has to a poem.
    expect(item?.id).toBe(1);
    expect(restored.timestamp).toBe(NOW.getTime());
  });

  it("brings back a poem the current draft no longer has, under the id and position it was saved with", () => {
    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshotFile(),
      currentFile: currentFile(),
      poemId: 7,
      now: NOW,
    });

    // The card's case: a version holds a poem that was deleted since. Restoring it means it reappears, and
    // `position` is what decides where it sits - not the slot it happened to occupy in the version's array.
    expect(ids(restored)).toEqual([1, 7, 2, 3]);
    expect(find(restored, 7)?.attributes).toEqual({
      createdAt: "2022-03-01T00:00:00.000Z",
      updatedAt: "2022-07-07T00:00:00.000Z",
      publishedAt: "2022-03-01T00:00:00.000Z",
      title: "Poem seven, deleted since",
      body: "an entry nothing in the draft holds",
      featured: false,
      position: 15,
    });
  });

  it("leaves every other poem exactly as the current draft held it", () => {
    const current = currentFile();
    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshotFile(),
      currentFile: current,
      poemId: 1,
      now: NOW,
    });

    // The sentence the card cares about, tested entry by entry rather than by array index: the reused upsert
    // re-sorts the array by `position`, so an index-equality test would pass on a file that has moved its
    // entries around and fail on one that has not.
    for (const id of [2, 3]) {
      expect(JSON.stringify(find(restored, id))).toBe(
        JSON.stringify(find(current, id)),
      );
    }

    expect(JSON.stringify(find(restored, 2))).not.toBe(
      JSON.stringify(find(snapshotFile(), 2)),
    );
  });

  it("restores one poem and not the rest of the version it came from", () => {
    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshotFile(),
      currentFile: currentFile(),
      poemId: 2,
      now: NOW,
    });

    // Version 700 also holds poem 1 and poem 7. A per-entry restore is the difference between "restore this
    // poem" and "roll the file back", and the app cannot tell those apart afterwards.
    expect(ids(restored)).toEqual([1, 2, 3]);
    expect(find(restored, 1)?.attributes.body).toBe("one");
    expect(find(restored, 7)).toBeUndefined();
  });

  it("keeps the version's `updatedAt` on the restored poem instead of stamping today on it", () => {
    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshotFile(),
      currentFile: currentFile(),
      poemId: 1,
      now: NOW,
    });

    // `buildStrapiPoemData` stamps `updatedAt: now` on every entry it rebuilds, which is what a save does -
    // and what a restore of one entry must not do to the entries it was not asked about. The restored
    // entry keeps the date the version recorded; the untouched entries keep theirs.
    expect(find(restored, 1)?.attributes.updatedAt).toBe(
      "2022-06-06T00:00:00.000Z",
    );
    expect(find(restored, 2)?.attributes.updatedAt).toBe(
      "2024-01-02T00:00:00.000Z",
    );
    expect(find(restored, 3)?.attributes.updatedAt).toBe(
      "2024-01-03T00:00:00.000Z",
    );
  });

  it("says no, out loud, when that version never held the poem", () => {
    expect(() =>
      restorePoemEntryFromSnapshot({
        snapshotFile: snapshotFile(),
        currentFile: currentFile(),
        poemId: 42,
        now: NOW,
      }),
    ).toThrow(/42/);
  });

  it("refuses a saved copy it cannot trust an id from, instead of inventing one", () => {
    // Version 700's poem 1 has its id poisoned to `0` - the shape a pre-t5 bundled seed (`{ id: 0, …}` from
    // `src/data/poems.json`) or a poisoned `"id": 0` produces. Both questions get a loud answer, and neither
    // one invents an id: `upsertPoemEditorValue` would have handed that entry the next free id in the file,
    // which is a rename into an id another version may already have restored.
    const poisoned = {
      ...snapshotFile(),
      data: {
        ...snapshotFile().data,
        data: (snapshotFile().data.data ?? []).map((item) =>
          item.id === 1 ? { ...item, id: 0 } : item,
        ),
      },
    };

    expect(() =>
      restorePoemEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: currentFile(),
        poemId: 0,
        now: NOW,
      }),
    ).toThrow(/no id this restore can trust/);

    // The id that was poisoned is gone from the version, so asking for it is a miss, not a search that
    // quietly picks some other poem.
    expect(() =>
      restorePoemEntryFromSnapshot({
        snapshotFile: poisoned,
        currentFile: currentFile(),
        poemId: 1,
        now: NOW,
      }),
    ).toThrow(/holds no poem 1 to restore/);
  });

  it("finds a pre-t5 snapshot's poem when its id is stored as a JSON string", () => {
    // The flat layout, from before Strapi exported drafts, held ids as strings, and a `PoemsFile` lies about
    // that at compile time (AGENTS.md fact 14). The editor already reads `"2"` as `2` through
    // `toPoemEditorValue`; a restore that compared the raw JSON would call a poem the version holds a miss -
    // and would put it back with a string id if it did match.
    const legacySnapshot: PoemsFile = {
      ...snapshotFile(),
      data: {
        ...snapshotFile().data,
        data: (snapshotFile().data.data ?? []).map((item) =>
          item.id === 2 ? { ...item, id: "2" as unknown as number } : item,
        ),
      },
    };

    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: legacySnapshot,
      currentFile: currentFile(),
      poemId: 2,
      now: NOW,
    });

    expect(find(restored, 2)?.id).toBe(2);
    expect(find(restored, 2)?.attributes.title).toBe("Poem two as it was");
    expect(
      restored.data.data.every((item) => typeof item.id === "number"),
    ).toBe(true);
  });
  it("carries what the reused upsert computes for the whole file, including the re-counted meta pagination", () => {
    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshotFile(),
      currentFile: currentFile(),
      poemId: 7,
      now: NOW,
    });

    // A per-entry restore should not have to know about this, and yet reusing the app's own helper means
    // `buildStrapiPoemData` re-derives the envelope from whatever the list turned out to be - the honest
    // thing to do is say so here, and pin it.
    expect(restored.data.meta.pagination.total).toBe(4);
    expect(restored.data.meta.pagination.pageCount).toBe(1);
    expect(restored.name).toBe("poems");
  });

  it("returns a new file and leaves the ones it was given alone", () => {
    const current = currentFile();
    const snapshot = snapshotFile();
    const before = JSON.stringify(current);
    const snapshotBefore = JSON.stringify(snapshot);

    const restored = restorePoemEntryFromSnapshot({
      snapshotFile: snapshot,
      currentFile: current,
      poemId: 1,
      now: NOW,
    });

    // A restored draft and the snapshot it came out of are not the same object, and neither of the files
    // this helper was handed is the file it wrote: the seam hands the merge result straight to `writeFile`.
    expect(restored).not.toBe(current);
    expect(JSON.stringify(current)).toBe(before);
    expect(JSON.stringify(snapshot)).toBe(snapshotBefore);
  });
});

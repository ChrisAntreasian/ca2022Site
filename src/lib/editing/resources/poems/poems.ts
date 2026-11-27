import { Schema } from "effect";

import { strapiPoemC, type StrapiPoem } from "#lib/typing/poem";

import type { EditorDefinition } from "../../core/definitions";

export const poemEditorValueC = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  bodyMarkdown: Schema.String,
  sortOrder: Schema.Number,
});

export type PoemEditorValue = Schema.Schema.Type<typeof poemEditorValueC>;

export type PoemsFile = {
  name: string;
  timestamp: number;
  data: StrapiPoem;
};

export const poemsFileC: Schema.Codec<PoemsFile, unknown> = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: strapiPoemC,
});

export const poemEditorDefinition = {
  key: "poems",
  label: "Poems",
  schema: poemEditorValueC,
  fields: [
    {
      name: "title",
      label: "Title",
      kind: "text",
      placeholder: "Poem title",
      required: true,
    },
    {
      name: "bodyMarkdown",
      label: "Body",
      kind: "markdown",
      placeholder: "Write the poem body in markdown",
      required: true,
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      kind: "number",
      required: true,
    },
  ],
  createDefault: () => ({
    id: 0,
    title: "",
    bodyMarkdown: "",
    sortOrder: 10,
  }),
} satisfies EditorDefinition<PoemEditorValue>;

const readItems = (file: PoemsFile) => file.data.data ?? [];

export const toPoemEditorValues = (
  file: PoemsFile,
): ReadonlyArray<PoemEditorValue> =>
  [...readItems(file)]
    .sort((left, right) => left.attributes.position - right.attributes.position)
    .map((item) => ({
      id: item.id,
      title: item.attributes.title,
      bodyMarkdown: item.attributes.body,
      sortOrder: item.attributes.position,
    }));

const nextPoemId = (file: PoemsFile) =>
  readItems(file).reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;

const buildStrapiPoemData = (
  file: PoemsFile,
  values: ReadonlyArray<PoemEditorValue>,
  timestamp: string,
): StrapiPoem => {
  const existingById = new Map(readItems(file).map((item) => [item.id, item]));

  const data = [...values]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((value) => {
      const existing = existingById.get(value.id);

      return {
        id: value.id,
        attributes: {
          createdAt: existing?.attributes.createdAt ?? timestamp,
          updatedAt: timestamp,
          publishedAt: existing?.attributes.publishedAt ?? timestamp,
          title: value.title,
          body: value.bodyMarkdown,
          featured: existing?.attributes.featured ?? false,
          position: value.sortOrder,
        },
      };
    });

  return {
    data,
    meta: {
      pagination: {
        page: 1,
        pageCount: data.length > 0 ? 1 : 0,
        pageSize: Math.max(
          file.data.meta.pagination.pageSize,
          data.length || 1,
        ),
        total: data.length,
      },
    },
  };
};

export const upsertPoemEditorValue = (
  file: PoemsFile,
  value: PoemEditorValue,
  now = new Date(),
): PoemsFile => {
  const timestamp = now.toISOString();
  const currentValues = toPoemEditorValues(file);
  const nextId = value.id > 0 ? value.id : nextPoemId(file);
  const nextValue = { ...value, id: nextId };
  const withoutCurrent = currentValues.filter((item) => item.id !== nextId);

  return {
    ...file,
    timestamp: now.getTime(),
    data: buildStrapiPoemData(file, [...withoutCurrent, nextValue], timestamp),
  };
};

export const removePoemEditorValue = (
  file: PoemsFile,
  poemId: number,
  now = new Date(),
): PoemsFile => {
  const timestamp = now.toISOString();
  const currentValues = toPoemEditorValues(file);
  const remainingValues = currentValues.filter((item) => item.id !== poemId);

  return {
    ...file,
    timestamp: now.getTime(),
    data: buildStrapiPoemData(file, remainingValues, timestamp),
  };
};

type PoemItem = NonNullable<PoemsFile["data"]["data"]>[number];

/**
 * The id an entry actually carries, in the only two shapes it has ever arrived in.
 *
 * A `PoemsFile` says `id: number`. Pre-t5 data - the flat layout, from before Strapi exported drafts - held
 * a poem's id as a JSON string and lied about it at compile time. `toPoemEditorValue` coerces `"12"` to `12`
 * for the same reason, and a restore has to coerce too: without it a legacy snapshot's poem is looked up
 * with a different handle than the one the editor showed the user, and a poem the version does hold gets
 * called a poem it does not.
 *
 * What comes back is the id, or `0` for "this entry has no id a restore can use" - the value
 * `toPoemEditorValues` already reserves for the same idea.
 */
const poemItemId = (item: PoemItem): number => {
  const raw: unknown = item.id;
  const id = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;

  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : 0;
};

/**
 * The version's own copy of one poem: the item, not the editor's projection of it.
 *
 * A poem this version never held is not a lookup failure to paper over. It is the file saying there is
 * nothing here to put back.
 */
const findPoemItem = (
  file: PoemsFile,
  poemId: number,
): PoemItem | undefined => {
  const items = readItems(file);
  // `poems` is the only content key in this app, so a version key has no id part to read off its name. But
  // `restoreEntry` hands `entryId` through without knowing what an id means to a poems file, so a key of the
  // form `poems-27` is read here rather than guessed at by the seam.
  const keyId = Number(/^(?:.*\/)?poems-(\d+)$/.exec(file.name)?.[1]);
  const requested = Number.isInteger(keyId) && keyId > 0 ? keyId : poemId;

  const matched = items.find((item) => poemItemId(item) === requested);

  if (matched) return matched;

  // A requested id that is usable and is not in this version is a genuine miss. A caller that named no id at
  // all (`0`, `NaN`, a poisoned `"id": 0`) can only be matched by an entry that also has no nameable id - and
  // the id check in `restorePoemEntryFromSnapshot` refuses even that match, out loud. Answering a caller who
  // named nothing with the version's first poem would restore a poem nobody asked for.
  if (requested > 0) return undefined;

  return items.find((item) => poemItemId(item) === 0);
};

/**
 * A version's poem in the editor's entry shape - the only shape `upsertPoemEditorValue` reads.
 *
 * The projection is lossy on purpose: it drops `featured` and the dates. It is the upsert's input, never the
 * thing a restore writes.
 */
const toPoemEditorEntry = (item: PoemItem): PoemEditorValue => ({
  id: poemItemId(item),
  title: item.attributes.title,
  bodyMarkdown: item.attributes.body,
  sortOrder: item.attributes.position,
});

/**
 * Restore one poem out of a saved version into the current draft.
 *
 * `upsertPoemEditorValue` is reused rather than re-invented: its id-collision guard is what decides
 * "replace this entry in place" versus "put it back in the list", and its ordering by `sortOrder` is the
 * ordering the rest of the site reads poems by. A per-entry restore has no business deciding either.
 *
 * What it does on top of the upsert is carry dates across: the restored entry keeps the copy the snapshot
 * wrote (`updatedAt` included, so a restored poem still shows its own date on the site) and every other
 * entry gets back the item the current draft already held, byte for byte. The file's own `timestamp` is
 * handled by the seam, not here.
 */
export type RestorePoemEntryInput = {
  snapshotFile: PoemsFile;
  currentFile: PoemsFile;
  poemId: number;
  now?: Date;
};

export const restorePoemEntryFromSnapshot = ({
  snapshotFile,
  currentFile,
  poemId,
  now = new Date(),
}: RestorePoemEntryInput): PoemsFile => {
  const snapshotPoem = findPoemItem(snapshotFile, poemId);

  if (!snapshotPoem) {
    throw new Error(
      `Version ${snapshotFile.timestamp} of ${snapshotFile.name} holds no poem ${poemId} to restore.`,
    );
  }

  // `upsertPoemEditorValue` treats an id it cannot trust as "no id yet": `id <= 0` gets the next free id in
  // the file, which is what a save must do with a poem the editor just made. A restore putting a poem back
  // under the id it was saved with may not do that: `poemItemId` answers "no id a restore can use" with 0,
  // and 0 here is a refusal rather than a rename into an id another version already restored.
  if (poemItemId(snapshotPoem) <= 0) {
    throw new Error(
      `Cannot restore poem ${poemId}: the saved copy carries no id this restore can trust.`,
    );
  }

  const merged = upsertPoemEditorValue(
    currentFile,
    toPoemEditorEntry(snapshotPoem),
    now,
  );

  // Reusing the upsert means taking its ordering and its id decision, and also taking the one thing it does
  // to every entry in the list: `buildStrapiPoemData` rebuilds each item from the editor values it was given
  // and stamps `updatedAt: now` on all of them. That is what a save does to a file being saved; it is not
  // what a restore of one poem is allowed to do to the other poems. Every entry that is not the restored one
  // is handed back the item the current draft already held, and the restored one gets the snapshot's own
  // attributes - dates, `featured` and `position` included.
  //
  // The ordering is the upsert's as well: `buildStrapiPoemData` sorts the editor values by `sortOrder`, so a
  // restored poem lands where its saved `position` puts it, not where the version's array happened to keep it
  // - and a current draft whose array order is not its display order loses nothing by having the array
  // re-sorted, because a poems array's index is not the order the site reads poems in.
  const currentItems = readItems(currentFile);

  const data = (merged.data.data ?? []).map((item) => {
    if (item.id === poemId) {
      return { id: item.id, attributes: { ...snapshotPoem.attributes } };
    }

    return currentItems.find((held) => held.id === item.id) ?? item;
  });

  return {
    ...merged,
    data: { ...merged.data, data },
  };
};

import { Schema } from "effect";

import { strapiBaseC, strapiMetaDataC } from "#lib/typing/strapi";
import { strapiImageDataC } from "#lib/typing/art";

import type { EditorDefinition } from "../../core/definitions";

export const souljuicerEntryC = Schema.Struct({
  id: Schema.Number,
  attributes: Schema.Struct({
    ...strapiBaseC.fields,
    title: Schema.optional(Schema.String),
    createdDate: Schema.optional(Schema.String),
    medium: Schema.optional(Schema.String),
    order: Schema.Number,
    description: Schema.String,
    image: strapiImageDataC,
  }),
});

export const souljuicerDataC = Schema.Struct({
  ...strapiMetaDataC.fields,
  data: Schema.Array(souljuicerEntryC),
});

export type SouljuicerData = Schema.Schema.Type<typeof souljuicerDataC>;

export type SouljuicerFile = {
  name: string;
  timestamp: number;
  data: SouljuicerData;
};

export const souljuicerFileC: Schema.Codec<SouljuicerFile, unknown> =
  Schema.Struct({
    name: Schema.String,
    timestamp: Schema.Number,
    data: souljuicerDataC,
  });

export const souljuicerEditorEntryC = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  createdDate: Schema.String,
  medium: Schema.String,
  description: Schema.String,
  sortOrder: Schema.Number,
  imageUrl: Schema.NullOr(Schema.String),
});

export type SouljuicerEditorEntry = Schema.Schema.Type<
  typeof souljuicerEditorEntryC
>;

export const souljuicerEditorValueC = Schema.Struct({
  entries: Schema.Array(souljuicerEditorEntryC),
});

export type SouljuicerEditorValue = Schema.Schema.Type<
  typeof souljuicerEditorValueC
>;

export const souljuicerEditorDefinition = {
  key: "the-souljuicer",
  label: "The SoulJuicer",
  schema: souljuicerEditorValueC,
  fields: [
    {
      name: "title",
      label: "Title",
      kind: "text",
      required: true,
    },
    {
      name: "createdDate",
      label: "Created Date",
      kind: "text",
      required: true,
    },
    {
      name: "medium",
      label: "Medium",
      kind: "text",
      required: true,
    },
    {
      name: "description",
      label: "Description",
      kind: "markdown",
      required: true,
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      kind: "number",
      required: true,
    },
  ],
  createDefault: () => ({ entries: [] }),
} satisfies EditorDefinition<SouljuicerEditorValue>;

export type UploadedImageAsset = {
  name: string;
  mime: string;
  size: number;
  url: string;
};

const defaultSouljuicerTitle = "the SoulJuicer";
const defaultSouljuicerMedium = "pencil";

const getSouljuicerCreatedDate = (entry: {
  createdDate?: string | undefined;
  createdAt: string;
}) => entry.createdDate ?? entry.createdAt;

export const toSouljuicerEditorValue = (
  file: SouljuicerFile,
): SouljuicerEditorValue => ({
  entries: [...(file.data.data ?? [])]
    .sort((left, right) => left.attributes.order - right.attributes.order)
    .map((entry) => ({
      id: entry.id,
      title: entry.attributes.title ?? defaultSouljuicerTitle,
      createdDate: getSouljuicerCreatedDate(entry.attributes),
      medium: entry.attributes.medium ?? defaultSouljuicerMedium,
      description: entry.attributes.description,
      sortOrder: entry.attributes.order,
      imageUrl: entry.attributes.image.data?.attributes.url ?? null,
    })),
});

export const upsertSouljuicerEditorValue = (
  file: SouljuicerFile,
  value: SouljuicerEditorValue,
  now = new Date(),
): SouljuicerFile => {
  const timestamp = now.toISOString();
  const existingById = new Map(
    file.data.data.map((entry) => [entry.id, entry]),
  );

  const nextData = [...value.entries]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => {
      const existing = existingById.get(entry.id);

      if (!existing) {
        return null;
      }

      return {
        ...existing,
        attributes: {
          ...existing.attributes,
          updatedAt: timestamp,
          title: entry.title,
          createdDate: entry.createdDate,
          medium: entry.medium,
          description: entry.description,
          order: entry.sortOrder,
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return {
    ...file,
    timestamp: now.getTime(),
    data: {
      ...file.data,
      data: nextData,
      meta: {
        ...file.data.meta,
        pagination: {
          ...file.data.meta.pagination,
          pageCount: nextData.length > 0 ? 1 : 0,
          total: nextData.length,
        },
      },
    },
  };
};

export const removeSouljuicerEntry = (
  file: SouljuicerFile,
  entryId: number,
  now = new Date(),
): SouljuicerFile => {
  const value = toSouljuicerEditorValue(file);

  return upsertSouljuicerEditorValue(
    file,
    {
      entries: value.entries.filter((entry) => entry.id !== entryId),
    },
    now,
  );
};

const sanitizeMediaHash = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "asset";

const readFileExt = (name: string) => {
  const index = name.lastIndexOf(".");

  return index >= 0 ? name.slice(index).toLowerCase() : "";
};

const toKilobytes = (sizeInBytes: number) =>
  Math.round((sizeInBytes / 1024) * 100) / 100;

const toImageBase = (prefix: string, asset: UploadedImageAsset) => {
  const ext = readFileExt(asset.name) || ".bin";
  const hash = `${prefix}_${sanitizeMediaHash(asset.name)}`;

  return {
    name: `${prefix}_${asset.name}`,
    hash,
    ext,
    mime: asset.mime || "application/octet-stream",
    path: null,
    width: 0,
    height: 0,
    size: toKilobytes(asset.size),
    url: asset.url,
  };
};

const toStrapiImageAttributes = (
  asset: UploadedImageAsset,
  timestamp: string,
) => {
  const fallbackName = asset.name || "upload";

  return {
    createdAt: timestamp,
    updatedAt: timestamp,
    alternativeText: fallbackName,
    caption: fallbackName,
    provider: "local",
    provider_metadata: null,
    previewUrl: null,
    url: asset.url,
    formats: {
      small: toImageBase("small", asset),
      thumbnail: toImageBase("thumbnail", asset),
    },
  };
};

const nextSouljuicerMediaId = (file: SouljuicerFile) =>
  (file.data.data ?? []).reduce(
    (maxId, entry) => Math.max(maxId, entry.attributes.image.data?.id ?? 0),
    0,
  ) + 1;

export const applySouljuicerImagePatch = (
  file: SouljuicerFile,
  entryId: number,
  image: UploadedImageAsset,
  now = new Date(),
): SouljuicerFile => {
  const timestamp = now.toISOString();
  const mediaId = nextSouljuicerMediaId(file);

  return {
    ...file,
    data: {
      ...file.data,
      data: (file.data.data ?? []).map((entry) =>
        entry.id !== entryId
          ? entry
          : {
              ...entry,
              attributes: {
                ...entry.attributes,
                updatedAt: timestamp,
                image: {
                  data: {
                    id: mediaId,
                    attributes: toStrapiImageAttributes(image, timestamp),
                  },
                },
              },
            },
      ),
    },
    timestamp: now.getTime(),
  };
};

// --- Restoring one saved entry into the current draft --------------------------------
//
// Everything below belongs to `restoreSouljuicerEntryFromSnapshot` alone, the one place that puts a
// saved version's copy of one SoulJuicer entry into a current draft, and it exists because a restore
// is a merge of two files rather than a write of one editor value.
//
// `upsertSouljuicerEditorValue` is still reused, because it is the function that decides which ids
// are decided, where a new entry lands in order, what a save stamps and how the pagination this
// resource writes is derived. The draft the page reads and the draft the restore writes are built by
// one function, and a second one carrying the same rules is one more place to keep in step. Reusing
// it turned out not to be enough, and the gaps below say exactly what it could not express.

// One item of a version's `data` array: the shape a version held for one SoulJuicer entry, and the
// only shape a restore can carry. `SouljuicerEditorEntry` is the same entry through the editor's own
// fields, and those fields carry no image beyond a url, no timestamps, and no empty side of the two
// fields a SoulJuicer entry may legitimately leave out.
type SouljuicerEntryItem = SouljuicerFile["data"]["data"][number];

/**
 * `data[].id` is typed a number, and every SoulJuicer file this repo holds has one. But a version is
 * untrusted JSON whatever the codec promised, and the entry a restore names comes out of a URL, where
 * an entry id is only as trustworthy as its own shape. A version whose id does not read as a positive
 * integer has nothing this restore can match it by, and an id read as zero can be matched against
 * nothing at all.
 */
const souljuicerItemId = (item: SouljuicerEntryItem): number => {
  const raw: unknown = item.id;
  const id = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;

  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : 0;
};

const souljuicerEntries = (
  file: SouljuicerFile,
): ReadonlyArray<SouljuicerEntryItem> => file.data?.data ?? [];

/**
 * Find one entry in one file. `id` is the only key a SoulJuicer entry can be matched by; the two
 * fields a SoulJuicer entry may leave out are filled in by the editor's own defaults, so a restore
 * that matched on a title would be matching a name the editor wrote rather than the entry it is
 * restoring, and a SoulJuicer entry with no `title` of its own has no name to match by at all.
 */
const findSouljuicerEntry = (
  file: SouljuicerFile,
  entryId: number,
): SouljuicerEntryItem | null =>
  souljuicerEntries(file).find(
    (item) => item.id === entryId || souljuicerItemId(item) === entryId,
  ) ?? null;

/**
 * The entry as an editor value. The defaults `toSouljuicerEditorValue` applies are applied here too,
 * and only because the upsert it feeds writes every field the editor's fields can carry: a file that
 * holds no `title` gets one written into it by this projection whether or not the restore agrees, and
 * what the projection writes is what the merge below hands back over with the version's own item.
 */
const toSouljuicerRestoreEntry = (
  item: SouljuicerEntryItem,
): SouljuicerEditorEntry => ({
  id: souljuicerItemId(item),
  title: item.attributes.title ?? defaultSouljuicerTitle,
  createdDate: getSouljuicerCreatedDate(item.attributes),
  medium: item.attributes.medium ?? defaultSouljuicerMedium,
  description: item.attributes.description,
  sortOrder: item.attributes.order,
  imageUrl: item.attributes.image?.data?.attributes?.url ?? null,
});

/**
 * The parameters `restoreSouljuicerEntryFromSnapshot` takes. They are spelled out here because each
 * one is how the route hands something over in the same order every time, and `now` is the optional
 * one: a restore files a baseline stamped with the moment it read, so a test that pins that moment
 * passes its own clock in instead of leaving `restore*` to read `new Date()`.
 */
export type RestoreSouljuicerEntryInput = {
  snapshotFile: SouljuicerFile;
  currentFile: SouljuicerFile;
  entryId: number;
  now?: Date;
};

/**
 * Put one saved version's copy of one SoulJuicer entry into a current draft.
 *
 * This is a pure function over two files and a moment. Every rule below holds for every SoulJuicer
 * entry, and none of it is a judgement call about which version to read or which tier to write:
 * `souljuicer.server.ts` decides that, and this function knows neither a tier nor a store nor a
 * clock.
 */
export const restoreSouljuicerEntryFromSnapshot = ({
  snapshotFile,
  currentFile,
  entryId,
  now = new Date(),
}: RestoreSouljuicerEntryInput): SouljuicerFile => {
  const snapshotEntry = findSouljuicerEntry(snapshotFile, entryId);

  if (!snapshotEntry) {
    throw new Error(
      `Version ${snapshotFile.timestamp} of ${snapshotFile.name} holds no SoulJuicer entry ${entryId} to restore.`,
    );
  }

  if (souljuicerItemId(snapshotEntry) <= 0) {
    throw new Error(
      `Cannot restore SoulJuicer entry ${entryId}: the saved copy carries no id this restore can trust.`,
    );
  }

  const current = toSouljuicerEditorValue(currentFile);
  const holdsEntry = current.entries.some((entry) => entry.id === entryId);
  const restoredEntry = toSouljuicerRestoreEntry(snapshotEntry);

  // Reuse the editor's own upsert for whatever it can express. `value.entries` is the whole entry
  // list, so this hands it the current list with the restored entry substituted in place, or appended
  // whole when the current draft never held it, which is a deleted entry put back.
  const merged = upsertSouljuicerEditorValue(
    currentFile,
    {
      ...current,
      entries: holdsEntry
        ? current.entries.map((entry) =>
            entry.id === entryId ? restoredEntry : entry,
          )
        : [...current.entries, restoredEntry],
    },
    now,
  );

  const restoredItem = {
    id: entryId,
    // A copy, so writing the version's own item into the draft's own array never touches the
    // version's file or the draft's item the version was copied out of.
    attributes: { ...snapshotEntry.attributes },
  } satisfies SouljuicerEntryItem;

  // The upsert's own entry list, with every entry but the restored one handed back as the draft's own
  // item rather than the upsert's copy of it. Three gaps are why.
  //
  // The first gap is the entry the upsert could not write at all. It writes every entry out of a copy
  // it already holds in the current draft, and drops every entry it does not: a deleted entry put back
  // leaves it with nothing to write, and the entry it would have written out of the editor's fields
  // alone would carry today's timestamps, an image of its own from the editor's url only, and a title
  // and a medium the version never held.
  //
  // The second gap is what the upsert stamps. It re-stamps `updatedAt` on every entry it writes and
  // hands each one the editor's projection of it, defaults and all. An ordinary save stamps the entry
  // it actually saved; a restore that stamped and re-shaped every entry in the list would look to the
  // next save and the next restore alike as if the editor had been shown every entry and saved them
  // all, and it would quietly write a title into an entry the version held no title for.
  //
  // The third gap is what the upsert counts. It derives this resource's pagination from the list it
  // managed to write, and that list is one entry short whenever the restored entry is one the draft
  // had dropped. A restore that left the count alone would report an entry the draft does not hold.
  const heldById = new Map(
    souljuicerEntries(currentFile).map((item) => [item.id, item]),
  );
  const entries = merged.data.data.map((item) =>
    item.id === entryId ? restoredItem : (heldById.get(item.id) ?? item),
  );

  if (!entries.some((item) => item.id === entryId)) {
    // The upsert writes the entry list in order, so an entry the upsert could not write lands where
    // its saved order puts it, which is where an ordinary save would have put the same entry.
    const restoredOrder = restoredItem.attributes?.order ?? 0;
    const before = entries.findIndex(
      (item) => (item.attributes?.order ?? 0) > restoredOrder,
    );

    if (before === -1) entries.push(restoredItem);
    else entries.splice(before, 0, restoredItem);
  }

  return {
    ...merged,
    data: {
      ...merged.data,
      data: entries,
      meta: {
        ...merged.data.meta,
        pagination: {
          ...merged.data.meta.pagination,
          pageCount: entries.length > 0 ? 1 : 0,
          total: entries.length,
        },
      },
    },
  };
};

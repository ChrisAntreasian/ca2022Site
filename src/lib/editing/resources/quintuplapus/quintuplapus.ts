import { Schema } from "effect";

import { artCategoryC } from "#lib/typing/art";
import { strapiMetaDataC, withIdC } from "#lib/typing/strapi";

import type { EditorDefinition } from "../../core/definitions";

export const quintuplapusDataC = Schema.Struct({
  ...strapiMetaDataC.fields,
  data: Schema.Array(withIdC(artCategoryC)),
});

export type QuintuplapusData = Schema.Schema.Type<typeof quintuplapusDataC>;

export type QuintuplapusFile = {
  name: string;
  timestamp: number;
  data: QuintuplapusData;
};

export const quintuplapusFileC: Schema.Codec<QuintuplapusFile, unknown> =
  Schema.Struct({
    name: Schema.String,
    timestamp: Schema.Number,
    data: quintuplapusDataC,
  });

export const quintuplapusEditorEntryC = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  description: Schema.String,
  createdDate: Schema.String,
  medium: Schema.String,
  sortOrder: Schema.Number,
  imageUrl: Schema.NullOr(Schema.String),
});

export type QuintuplapusEditorEntry = Schema.Schema.Type<
  typeof quintuplapusEditorEntryC
>;

export const quintuplapusEditorValueC = Schema.Struct({
  categoryId: Schema.Number,
  categoryTitle: Schema.String,
  entries: Schema.Array(quintuplapusEditorEntryC),
});

export type QuintuplapusEditorValue = Schema.Schema.Type<
  typeof quintuplapusEditorValueC
>;

export const quintuplapusEditorDefinition = {
  key: "the-quintuplapus",
  label: "The Quintuplapus",
  schema: quintuplapusEditorValueC,
  fields: [
    {
      name: "categoryTitle",
      label: "Category Title",
      kind: "text",
      required: true,
    },
    { name: "title", label: "Title", kind: "text", required: true },
    {
      name: "description",
      label: "Description",
      kind: "markdown",
      required: true,
    },
    {
      name: "createdDate",
      label: "Created Date",
      kind: "text",
      required: true,
    },
    { name: "medium", label: "Medium", kind: "text", required: true },
    { name: "sortOrder", label: "Sort Order", kind: "number", required: true },
  ],
  createDefault: () => ({
    categoryId: 0,
    categoryTitle: "",
    entries: [],
  }),
} satisfies EditorDefinition<QuintuplapusEditorValue>;

export type UploadedImageAsset = {
  name: string;
  mime: string;
  size: number;
  url: string;
};

export const toQuintuplapusEditorValue = (
  file: QuintuplapusFile,
): QuintuplapusEditorValue => {
  const category = file.data.data?.[0];
  const entries = category?.attributes.art_pieces?.data ?? [];
  const omitIds = (category?.attributes.omit?.data ?? []).map(
    (item) => item.id,
  );

  if (!category) {
    return quintuplapusEditorDefinition.createDefault();
  }

  return {
    categoryId: category.id,
    categoryTitle: category.attributes.title,
    entries: [...entries]
      .filter((entry) => !omitIds.includes(entry.id))
      .sort((left, right) => left.attributes.order - right.attributes.order)
      .map((entry) => ({
        id: entry.id,
        title: entry.attributes.title,
        description: entry.attributes.description,
        createdDate: entry.attributes.createdDate,
        medium: entry.attributes.medium,
        sortOrder: entry.attributes.order,
        imageUrl: entry.attributes.image.data?.attributes.url ?? null,
      })),
  };
};

export const upsertQuintuplapusEditorValue = (
  file: QuintuplapusFile,
  value: QuintuplapusEditorValue,
  now = new Date(),
): QuintuplapusFile => {
  const timestamp = now.toISOString();
  const category = file.data.data?.[0];
  const existingById = new Map(
    (category?.attributes.art_pieces?.data ?? []).map((entry) => [
      entry.id,
      entry,
    ]),
  );

  if (!category) {
    return file;
  }

  const nextEntries = [...value.entries]
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
          description: entry.description,
          createdDate: entry.createdDate,
          medium: entry.medium,
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
      data: [
        {
          ...category,
          attributes: {
            ...category.attributes,
            updatedAt: timestamp,
            title: value.categoryTitle,
            art_pieces: {
              data: nextEntries,
            },
          },
        },
      ],
    },
  };
};

export const removeQuintuplapusEntry = (
  file: QuintuplapusFile,
  entryId: number,
  now = new Date(),
): QuintuplapusFile => {
  const value = toQuintuplapusEditorValue(file);

  return upsertQuintuplapusEditorValue(
    file,
    {
      ...value,
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

const nextQuintuplapusMediaId = (file: QuintuplapusFile) => {
  const category = file.data.data?.[0];

  return (
    (category?.attributes.art_pieces?.data ?? []).reduce(
      (maxId, entry) => Math.max(maxId, entry.attributes.image.data?.id ?? 0),
      0,
    ) + 1
  );
};

export const applyQuintuplapusImagePatch = (
  file: QuintuplapusFile,
  entryId: number,
  image: UploadedImageAsset,
  now = new Date(),
): QuintuplapusFile => {
  const category = file.data.data?.[0];

  if (!category) {
    return file;
  }

  const timestamp = now.toISOString();
  const mediaId = nextQuintuplapusMediaId(file);

  return {
    ...file,
    data: {
      ...file.data,
      data: [
        {
          ...category,
          attributes: {
            ...category.attributes,
            art_pieces: {
              data: (category.attributes.art_pieces?.data ?? []).map((entry) =>
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
                            attributes: toStrapiImageAttributes(
                              image,
                              timestamp,
                            ),
                          },
                        },
                      },
                    },
              ),
            },
          },
        },
      ],
    },
    timestamp: now.getTime(),
  };
};

// --- Restoring one saved entry into the current draft --------------------------------
//
// Everything below belongs to `restoreQuintuplapusEntryFromSnapshot` alone, the one place that
// puts a saved version's copy of one Quintuplapus entry into a current draft, and it exists
// because a restore is a merge of two files rather than a write of one editor value.
//
// `upsertQuintuplapusEditorValue` is still reused, because it is the function that decides which
// ids are decided, where a new entry lands in order, and what a save stamps. The draft the page
// reads and the draft the restore writes are built by one function, and a second one carrying the
// same rules is one more place to keep in step. Reusing it turned out not to be enough, and the
// three gaps below say exactly what it could not express.

// One item of a version's `art_pieces` array: the shape a version held for one Quintuplapus entry,
// and the only shape a restore can carry. `QuintuplapusEditorEntry` is the same entry through the
// editor's own fields, and those fields carry no image beyond a url, and no timestamps at all.
type QuintuplapusCategoryItem = QuintuplapusFile["data"]["data"][number];

type QuintuplapusArtPieceItem = NonNullable<
  NonNullable<QuintuplapusCategoryItem["attributes"]["art_pieces"]>["data"]
>[number];

/**
 * `art_pieces[].id` is typed a number, and every Quintuplapus file this repo holds has one. But a
 * version is untrusted JSON whatever the codec promised, and the entry a restore names comes out of
 * a URL, where an entry id is only as trustworthy as its own shape. A version whose id does not read
 * as a positive integer has nothing this restore can match it by, and an id read as zero can be
 * matched against nothing at all.
 */
const quintuplapusItemId = (item: QuintuplapusArtPieceItem): number => {
  const raw: unknown = item.id;
  const id = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;

  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : 0;
};

const quintuplapusArtPieces = (
  file: QuintuplapusFile,
): Array<QuintuplapusArtPieceItem> => {
  const data = file.data?.data?.[0]?.attributes?.art_pieces?.data;

  return Array.isArray(data) ? data : [];
};

/**
 * Find one entry in one file. `id` is the only key a Quintuplapus entry can be matched by; `title`
 * is free text a save rewrites, and a restore that matched on it would put the entry the current
 * draft calls by that name into a version it never held.
 */
const findQuintuplapusArtPiece = (
  file: QuintuplapusFile,
  entryId: number,
): QuintuplapusArtPieceItem | null =>
  quintuplapusArtPieces(file).find(
    (item) => item.id === entryId || quintuplapusItemId(item) === entryId,
  ) ?? null;

/** The entry as an editor value: the version's own title, date, medium and saved order. */
const toQuintuplapusRestoreEntry = (
  item: QuintuplapusArtPieceItem,
): QuintuplapusEditorEntry => ({
  id: quintuplapusItemId(item),
  title: item.attributes.title,
  description: item.attributes.description,
  createdDate: item.attributes.createdDate,
  medium: item.attributes.medium,
  sortOrder: item.attributes.order,
  imageUrl: item.attributes.image?.data?.attributes?.url ?? null,
});

/**
 * The parameters `restoreQuintuplapusEntryFromSnapshot` takes. They are spelled out here because
 * each one is how the route hands something over in the same order every time, and `now` is the
 * optional one: a restore files a baseline stamped with the moment it read, so a test that pins that
 * moment passes its own clock in instead of leaving `restore*` to read `new Date()`.
 */
export type RestoreQuintuplapusEntryInput = {
  snapshotFile: QuintuplapusFile;
  currentFile: QuintuplapusFile;
  entryId: number;
  now?: Date;
};

/**
 * Put one saved version's copy of one Quintuplapus entry into a current draft.
 *
 * This is a pure function over two files and a moment. Every rule below holds for every Quintuplapus
 * entry, and none of it is a judgement call about which version to read or which tier to write:
 * `quintuplapus.server.ts` decides that, and this function knows neither a tier nor a store nor a
 * clock.
 */
export const restoreQuintuplapusEntryFromSnapshot = ({
  snapshotFile,
  currentFile,
  entryId,
  now = new Date(),
}: RestoreQuintuplapusEntryInput): QuintuplapusFile => {
  const snapshotEntry = findQuintuplapusArtPiece(snapshotFile, entryId);

  if (!snapshotEntry) {
    throw new Error(
      `Version ${snapshotFile.timestamp} of ${snapshotFile.name} holds no Quintuplapus entry ${entryId} to restore.`,
    );
  }

  if (quintuplapusItemId(snapshotEntry) <= 0) {
    throw new Error(
      `Cannot restore Quintuplapus entry ${entryId}: the saved copy carries no id this restore can trust.`,
    );
  }

  const currentCategory = currentFile.data?.data?.[0];

  if (!currentCategory) {
    throw new Error(
      `The draft being restored into holds no Quintuplapus category to restore entry ${entryId} into.`,
    );
  }

  const current = toQuintuplapusEditorValue(currentFile);
  const holdsEntry = current.entries.some((entry) => entry.id === entryId);
  const restoredEntry = toQuintuplapusRestoreEntry(snapshotEntry);

  // Reuse the editor's own upsert for whatever it can express. `value.entries` is the whole entry
  // list, so this hands it the current list with the restored entry substituted in place, or
  // appended whole when the current draft never held it, which is a deleted entry put back.
  const merged = upsertQuintuplapusEditorValue(
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
  } satisfies QuintuplapusArtPieceItem;

  // The upsert's own `art_pieces` list, with every entry but the restored one handed back as the
  // draft's own item rather than the upsert's copy of it. Two gaps are why.
  //
  // The first gap is the entry the upsert could not write at all. It writes every entry out of a copy
  // it already holds in the current draft, and drops every entry it does not: a deleted entry put back
  // leaves it with nothing to write, and the entry it would have written out of the editor's fields
  // alone would carry today's timestamps and an image built from the editor's url alone.
  //
  // The second gap is what the upsert stamps. It re-stamps `updatedAt` on every entry it writes and
  // hands each one the editor's projection of it. An ordinary save stamps the entry it actually saved;
  // a restore that stamped and re-shaped every entry in the list would look to the next save and the
  // next restore alike as if the editor had been shown every entry and saved them all.
  //
  // What the upsert carries with it is worth naming out loud rather than hiding: `toQuintuplapusEditorValue`
  // drops every art piece the category's `omit` list names, and `upsert*` writes `art_pieces` from the
  // editor's list alone, so a save has already removed those pieces from a draft before this point, and a
  // restore inherits that. It is the only choice consistent with what the editor does today, and the copy
  // of `the-quintuplapus` this repo holds names nothing in its `omit` list, so nothing real is dropped by
  // it.
  const heldById = new Map(
    quintuplapusArtPieces(currentFile).map((item) => [item.id, item]),
  );
  const artPieces = (
    merged.data?.data?.[0]?.attributes?.art_pieces?.data ?? []
  ).map((item) =>
    item.id === entryId ? restoredItem : (heldById.get(item.id) ?? item),
  );

  if (!artPieces.some((item) => item.id === entryId)) {
    // The upsert writes the entry list in order, so an entry the upsert could not write lands where its
    // saved order puts it, which is where an ordinary save would have put the same entry.
    const restoredOrder = restoredItem.attributes?.order ?? 0;
    const before = artPieces.findIndex(
      (item) => (item.attributes?.order ?? 0) > restoredOrder,
    );

    if (before === -1) artPieces.push(restoredItem);
    else artPieces.splice(before, 0, restoredItem);
  }

  return {
    ...merged,
    data: {
      ...merged.data,
      data: [
        {
          ...currentCategory,
          attributes: {
            ...currentCategory.attributes,
            // The category's own attributes are handed back from the draft: the upsert re-stamped it
            // and re-wrote its title from the editor's projection, and a restore that left them
            // stamped and re-written would read as though the category itself had been edited.
            art_pieces: {
              ...currentCategory.attributes.art_pieces,
              data: artPieces,
            },
          },
        },
      ],
    },
  };
};

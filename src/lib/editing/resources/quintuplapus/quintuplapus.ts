import { Schema } from "effect";

import { artCategoryC } from "$lib/typing/art";
import { strapiMetaDataC, withIdC } from "$lib/typing/strapi";

import type { EditorDefinition } from "../../core/definitions";

export const quintuplapusDataC = Schema.extend(
  strapiMetaDataC,
  Schema.Struct({
    data: Schema.Array(withIdC(artCategoryC)),
  }),
);

export type QuintuplapusData = Schema.Schema.Type<typeof quintuplapusDataC>;

export type QuintuplapusFile = {
  name: string;
  timestamp: number;
  data: QuintuplapusData;
};

export const quintuplapusFileC: Schema.Schema<
  QuintuplapusFile,
  QuintuplapusFile,
  never
> = Schema.Struct({
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
  schema: quintuplapusEditorValueC as Schema.Schema<
    QuintuplapusEditorValue,
    unknown,
    never
  >,
  fields: [
    { name: "categoryTitle", label: "Category Title", kind: "text", required: true },
    { name: "title", label: "Title", kind: "text", required: true },
    { name: "description", label: "Description", kind: "markdown", required: true },
    { name: "createdDate", label: "Created Date", kind: "text", required: true },
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
  const omitIds = (category?.attributes.omit?.data ?? []).map((item) => item.id);

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
    (category?.attributes.art_pieces?.data ?? []).map((entry) => [entry.id, entry]),
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

const toStrapiImageAttributes = (asset: UploadedImageAsset, timestamp: string) => {
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
                            attributes: toStrapiImageAttributes(image, timestamp),
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
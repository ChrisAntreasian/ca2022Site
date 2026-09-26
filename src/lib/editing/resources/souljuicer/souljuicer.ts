import { Schema } from "effect";

import { strapiBaseC, strapiMetaDataC } from "$lib/typing/strapi";
import { strapiImageDataC } from "$lib/typing/art";

import type { EditorDefinition } from "../../core/definitions";

export const souljuicerEntryC = Schema.Struct({
  id: Schema.Number,
  attributes: Schema.extend(
    strapiBaseC,
    Schema.Struct({
      title: Schema.optional(Schema.String),
      createdDate: Schema.optional(Schema.String),
      medium: Schema.optional(Schema.String),
      order: Schema.Number,
      description: Schema.String,
      image: strapiImageDataC,
    }),
  ),
});

export const souljuicerDataC = Schema.extend(
  strapiMetaDataC,
  Schema.Struct({
    data: Schema.Array(souljuicerEntryC),
  }),
);

export type SouljuicerData = Schema.Schema.Type<typeof souljuicerDataC>;

export type SouljuicerFile = {
  name: string;
  timestamp: number;
  data: SouljuicerData;
};

export const souljuicerFileC: Schema.Schema<SouljuicerFile, SouljuicerFile, never> =
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
  schema: souljuicerEditorValueC as Schema.Schema<
    SouljuicerEditorValue,
    unknown,
    never
  >,
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
  const existingById = new Map(file.data.data.map((entry) => [entry.id, entry]));

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
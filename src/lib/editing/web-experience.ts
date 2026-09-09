import { Schema } from "effect";

import { pageResC, type PageRes } from "$lib/typing/page";

import type { EditorDefinition } from "./definitions";

export const webExperienceEntryC = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  bodyMarkdown: Schema.String,
  primaryLink: Schema.String,
  secondaryLink: Schema.NullOr(Schema.String),
  sortOrder: Schema.Number,
});

export type WebExperienceEntry = Schema.Schema.Type<typeof webExperienceEntryC>;

export const webExperienceEditorValueC = Schema.Struct({
  pageId: Schema.Number,
  pageTitle: Schema.String,
  introId: Schema.Number,
  introTitle: Schema.String,
  introBodyMarkdown: Schema.String,
  entries: Schema.Array(webExperienceEntryC),
});

export type WebExperienceEditorValue = Schema.Schema.Type<
  typeof webExperienceEditorValueC
>;

export type WebExperienceFile = {
  name: string;
  timestamp: number;
  data: PageRes;
};

export type UploadedImageAsset = {
  name: string;
  mime: string;
  size: number;
  url: string;
};

export type WebExperienceMediaPatch = {
  entryId: number;
  removeLogo?: boolean;
  logo?: UploadedImageAsset | null;
  removeImageIds?: ReadonlyArray<number>;
  images?: ReadonlyArray<UploadedImageAsset> | null;
};

export type WebExperienceImagePreview = {
  id: number;
  small: string;
  large: string;
};

export type WebExperienceTarget =
  | {
      kind: "intro";
      title: string;
      bodyMarkdown: string;
      pageTitle: string;
    }
  | ({
      kind: "entry";
      id: number;
      title: string;
      bodyMarkdown: string;
      primaryLink: string;
      secondaryLink: string | null;
      sortOrder: number;
      logoUrl?: string | null;
      imagePreviews?: ReadonlyArray<WebExperienceImagePreview>;
    });

export const webExperienceFileC: Schema.Schema<
  WebExperienceFile,
  WebExperienceFile,
  never
> = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: pageResC,
});

export const webExperienceEditorDefinition = {
  key: "web-experience",
  label: "Web Experience",
  schema: webExperienceEditorValueC as Schema.Schema<
    WebExperienceEditorValue,
    unknown,
    never
  >,
  fields: [
    { name: "pageTitle", label: "Page Title", kind: "text", required: true },
    { name: "introTitle", label: "Intro Title", kind: "text", required: true },
    {
      name: "introBodyMarkdown",
      label: "Intro Body",
      kind: "markdown",
      required: true,
    },
  ],
  createDefault: () => ({
    pageId: 0,
    pageTitle: "",
    introId: 0,
    introTitle: "",
    introBodyMarkdown: "",
    entries: [],
  }),
} satisfies EditorDefinition<WebExperienceEditorValue>;

export const toWebExperienceEditorValue = (
  file: WebExperienceFile,
): WebExperienceEditorValue => {
  const page = file.data.data?.[0];
  const intro = page?.attributes.page_details.data?.[0];

  if (!page || !intro) {
    return webExperienceEditorDefinition.createDefault();
  }

  const entries = [...(page.attributes.rich_links?.data ?? [])]
    .sort((left, right) => left.attributes.position - right.attributes.position)
    .map((entry) => ({
      id: entry.id,
      title: entry.attributes.title,
      bodyMarkdown: entry.attributes.body,
      primaryLink: entry.attributes.link,
      secondaryLink: entry.attributes.secondLink,
      sortOrder: entry.attributes.position,
    }));

  return {
    pageId: page.id,
    pageTitle: page.attributes.title,
    introId: intro.id,
    introTitle: intro.attributes.title,
    introBodyMarkdown: intro.attributes.description,
    entries,
  };
};

export const upsertWebExperienceEditorValue = (
  file: WebExperienceFile,
  value: WebExperienceEditorValue,
  now = new Date(),
): WebExperienceFile => {
  const timestamp = now.toISOString();
  const page = file.data.data?.[0];
  const intro = page?.attributes.page_details.data?.[0];

  if (!page || !intro) {
    return file;
  }

  const entryById = new Map(
    (page.attributes.rich_links?.data ?? []).map((entry) => [entry.id, entry]),
  );
  const nextEntryId =
    (page.attributes.rich_links?.data ?? []).reduce(
      (maxId, entry) => Math.max(maxId, entry.id),
      0,
    ) + 1;
  let generatedId = nextEntryId;

  const richLinks = [...value.entries]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => {
      const entryId = entry.id > 0 ? entry.id : generatedId++;
      const existing = entryById.get(entryId);

      if (!existing) {
        return {
          id: entryId,
          attributes: {
            createdAt: timestamp,
            updatedAt: timestamp,
            publishedAt: timestamp,
            title: entry.title,
            body: entry.bodyMarkdown,
            image: { data: [] },
            logo: { data: null },
            link: entry.primaryLink,
            secondLink: entry.secondaryLink,
            position: entry.sortOrder,
          },
        };
      }

      return {
        ...existing,
        attributes: {
          ...existing.attributes,
          updatedAt: timestamp,
          title: entry.title,
          body: entry.bodyMarkdown,
          link: entry.primaryLink,
          secondLink: entry.secondaryLink,
          position: entry.sortOrder,
        },
      };
    });

  return {
    ...file,
    timestamp: now.getTime(),
    data: {
      ...file.data,
      data: [
        {
          ...page,
          attributes: {
            ...page.attributes,
            updatedAt: timestamp,
            title: value.pageTitle,
            page_details: {
              data: [
                {
                  ...intro,
                  attributes: {
                    ...intro.attributes,
                    updatedAt: timestamp,
                    title: value.introTitle,
                    description: value.introBodyMarkdown,
                  },
                },
              ],
            },
            rich_links: {
              data: richLinks,
            },
          },
        },
      ],
    },
  };
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

const nextWebExperienceMediaId = (file: WebExperienceFile) => {
  const page = file.data.data?.[0];

  if (!page) {
    return 1;
  }

  let maxId = 0;

  for (const entry of page.attributes.rich_links?.data ?? []) {
    const logoId = entry.attributes.logo.data?.id;

    if (typeof logoId === "number") {
      maxId = Math.max(maxId, logoId);
    }

    for (const image of entry.attributes.image.data ?? []) {
      maxId = Math.max(maxId, image.id);
    }
  }

  return maxId + 1;
};

export const applyWebExperienceMediaPatch = (
  file: WebExperienceFile,
  patch: WebExperienceMediaPatch,
  now = new Date(),
): WebExperienceFile => {
  const page = file.data.data?.[0];

  if (!page) {
    return file;
  }

  const timestamp = now.toISOString();
  let nextId = nextWebExperienceMediaId(file);
  const assignId = () => {
    const currentId = nextId;
    nextId += 1;

    return currentId;
  };

  const richLinks = (page.attributes.rich_links?.data ?? []).map((entry) => {
    if (entry.id !== patch.entryId) {
      return entry;
    }

    const nextAttributes = {
      ...entry.attributes,
      updatedAt: timestamp,
    };

    if (patch.logo !== undefined) {
      nextAttributes.logo = {
        data:
          patch.logo === null
            ? null
            : {
                id: assignId(),
                attributes: toStrapiImageAttributes(patch.logo, timestamp),
              },
      };
    } else if (patch.removeLogo) {
      nextAttributes.logo = { data: null };
    }

    const hasImageRemovals = Boolean(patch.removeImageIds?.length);
    const hasImageUploads = patch.images !== undefined;

    if (hasImageRemovals || hasImageUploads) {
      const removeIds = new Set(patch.removeImageIds ?? []);
      const retainedImages = (entry.attributes.image.data ?? []).filter(
        (image) => !removeIds.has(image.id),
      );
      const uploadedImages = (patch.images ?? []).map((asset) => ({
        id: assignId(),
        attributes: toStrapiImageAttributes(asset, timestamp),
      }));

      nextAttributes.image = {
        data: [...retainedImages, ...uploadedImages],
      };
    }

    return {
      ...entry,
      attributes: nextAttributes,
    };
  });

  return {
    ...file,
    data: {
      ...file.data,
      data: [
        {
          ...page,
          attributes: {
            ...page.attributes,
            rich_links: {
              data: richLinks,
            },
          },
        },
      ],
    },
  };
};

export const buildWebExperienceTarget = (
  file: WebExperienceFile,
  value: WebExperienceEditorValue,
  selection:
    | { kind: "intro" }
    | { kind: "new" }
    | { kind: "entry"; id: number },
): WebExperienceTarget | null => {
  if (selection.kind === "intro") {
    return {
      kind: "intro",
      title: value.introTitle,
      bodyMarkdown: value.introBodyMarkdown,
      pageTitle: value.pageTitle,
    };
  }

  if (selection.kind === "new") {
    const nextSortOrder =
      value.entries.reduce((maxOrder, entry) => Math.max(maxOrder, entry.sortOrder), 0) + 10;

    return {
      kind: "entry",
      id: 0,
      title: "",
      bodyMarkdown: "",
      primaryLink: "",
      secondaryLink: null,
      sortOrder: nextSortOrder,
      logoUrl: null,
      imagePreviews: [],
    };
  }

  const page = file.data.data?.[0];
  const entry = value.entries.find((item) => item.id === selection.id);
  const sourceEntry = page?.attributes.rich_links?.data?.find((item) => item?.id === selection.id);

  if (!entry) {
    return null;
  }

  return {
    kind: "entry",
    ...entry,
    logoUrl: sourceEntry?.attributes.logo.data?.attributes.url ?? null,
    imagePreviews: (sourceEntry?.attributes.image.data ?? [])
      .filter((image): image is NonNullable<typeof image> => Boolean(image))
      .map((image) => {
        const previewAttributes = image.attributes as {
          url: string;
          formats?: {
            small?: {
              url: string;
            };
          };
        };
        const smallUrl = previewAttributes.formats?.small?.url ?? previewAttributes.url;

        return {
          id: image.id,
          small: smallUrl,
          large: previewAttributes.url,
        };
      }),
  };
};
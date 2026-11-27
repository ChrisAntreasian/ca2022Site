import { Schema } from "effect";

import { pageResC, type PageRes } from "#lib/typing/page";

import type { EditorDefinition } from "../../core/definitions";

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
  | {
      kind: "entry";
      id: number;
      title: string;
      bodyMarkdown: string;
      primaryLink: string;
      secondaryLink: string | null;
      sortOrder: number;
      logoUrl?: string | null;
      imagePreviews?: ReadonlyArray<WebExperienceImagePreview>;
    };

export const webExperienceFileC: Schema.Codec<WebExperienceFile, unknown> =
  Schema.Struct({
    name: Schema.String,
    timestamp: Schema.Number,
    data: pageResC,
  });

export const webExperienceEditorDefinition = {
  key: "web-experience",
  label: "Web Experience",
  schema: webExperienceEditorValueC,
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

export const removeWebExperienceEntry = (
  file: WebExperienceFile,
  entryId: number,
  now = new Date(),
): WebExperienceFile => {
  const value = toWebExperienceEditorValue(file);

  return upsertWebExperienceEditorValue(
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
    { kind: "intro" } | { kind: "new" } | { kind: "entry"; id: number },
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
      value.entries.reduce(
        (maxOrder, entry) => Math.max(maxOrder, entry.sortOrder),
        0,
      ) + 10;

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
  const sourceEntry = page?.attributes.rich_links?.data?.find(
    (item) => item?.id === selection.id,
  );

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
        const smallUrl =
          previewAttributes.formats?.small?.url ?? previewAttributes.url;

        return {
          id: image.id,
          small: smallUrl,
          large: previewAttributes.url,
        };
      }),
  };
};

// --- Restoring one saved entry into the current draft --------------------------------
//
// Everything below belongs to `restoreWebExperienceEntryFromSnapshot` alone, the one place that
// puts a saved version's copy of one web experience entry into a current draft, and it exists
// because a restore is a merge of two files rather than a write of one editor value.
//
// `upsertWebExperienceEditorValue` is still reused, because it is the function that decides which
// ids are decided, where a new entry lands in position order, and what a page-level save stamps.
// The draft the page reads and the draft the restore writes are built by one function, and a
// second one carrying the same rules is one more place to keep in step. Reusing it turned out not
// to be enough, and what it could not express is what the rest of this block closes.

// One item of a version's `rich_links` array: the shape a version held for one web experience
// entry, and the only shape a restore can carry. `WebExperienceEntry` is the same entry through
// the editor's own fields, and those fields carry no logo, no screenshots and no ordering key of
// their own.
type WebExperiencePageItem = NonNullable<
  WebExperienceFile["data"]["data"]
>[number];

type WebExperienceRichLinkItem = NonNullable<
  NonNullable<WebExperiencePageItem["attributes"]["rich_links"]>["data"]
>[number];

/**
 * `rich_links[].id` is typed a number, and every web experience file this repo holds has one. But
 * a version is untrusted JSON whatever the codec promised, and the entry a restore names comes out
 * of a URL, where an entry id is only as trustworthy as its own shape. A version whose id does not
 * read as a positive integer has nothing this restore can match it by, and an id read as zero can
 * be matched against nothing at all.
 */
const webExperienceItemId = (item: WebExperienceRichLinkItem): number => {
  const raw: unknown = item.id;
  const id = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;

  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : 0;
};

const webExperienceRichLinks = (
  file: WebExperienceFile,
): ReadonlyArray<WebExperienceRichLinkItem> =>
  file.data?.data?.[0]?.attributes?.rich_links?.data ?? [];

/**
 * Find one entry in one file. `id` is the only key a web experience entry can be matched by;
 * `title` is free text a save rewrites, and a restore that matched on it would put the entry the
 * current draft calls by that name into a version it never held.
 */
const findWebExperienceRichLink = (
  file: WebExperienceFile,
  entryId: number,
): WebExperienceRichLinkItem | null =>
  webExperienceRichLinks(file).find(
    (item) => item.id === entryId || webExperienceItemId(item) === entryId,
  ) ?? null;

/** The entry as an editor value: the version's own title, body, links and saved position. */
const toWebExperienceRestoreEntry = (
  item: WebExperienceRichLinkItem,
): WebExperienceEntry => ({
  id: webExperienceItemId(item),
  title: item.attributes.title,
  bodyMarkdown: item.attributes.body,
  primaryLink: item.attributes.link,
  secondaryLink: item.attributes.secondLink,
  sortOrder: item.attributes.position,
});

/**
 * The parameters `restoreWebExperienceEntryFromSnapshot` takes. They are spelled out here because
 * each one is how the route hands something over in the same order every time, and `now` is the
 * optional one: a restore files a baseline stamped with the moment it read, so a test that pins
 * that moment passes its own clock in instead of leaving `restore*` to read `new Date()`.
 */
export type RestoreWebExperienceEntryInput = {
  snapshotFile: WebExperienceFile;
  currentFile: WebExperienceFile;
  entryId: number;
  now?: Date;
};

/**
 * Put one saved version's copy of one web experience entry into a current draft.
 *
 * This is a pure function over two files and a moment. Every rule below holds for every web
 * experience entry, and none of it is a judgement call about which version to read or which tier
 * to write: `web-experience.server.ts` decides that, and this function knows neither a tier nor a
 * store nor a clock.
 */
export const restoreWebExperienceEntryFromSnapshot = ({
  snapshotFile,
  currentFile,
  entryId,
  now = new Date(),
}: RestoreWebExperienceEntryInput): WebExperienceFile => {
  const snapshotEntry = findWebExperienceRichLink(snapshotFile, entryId);

  if (!snapshotEntry) {
    throw new Error(
      `Version ${snapshotFile.timestamp} of ${snapshotFile.name} holds no web experience entry ${entryId} to restore.`,
    );
  }

  if (webExperienceItemId(snapshotEntry) <= 0) {
    throw new Error(
      `Cannot restore web experience entry ${entryId}: the saved copy carries no id this restore can trust.`,
    );
  }

  const currentPage = currentFile.data?.data?.[0];

  if (!currentPage) {
    throw new Error(
      `The draft being restored into holds no web experience page to restore entry ${entryId} into.`,
    );
  }

  const current = toWebExperienceEditorValue(currentFile);
  const holdsEntry = current.entries.some((entry) => entry.id === entryId);
  const restoredEntry = toWebExperienceRestoreEntry(snapshotEntry);

  // Reuse the editor's own upsert for whatever it can express. `value.entries` is the whole entry
  // list, so this hands it the current list with the restored entry substituted in place, or
  // appended whole when the current draft never held it, which is a deleted entry put back.
  const merged = upsertWebExperienceEditorValue(
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

  const heldById = new Map(
    webExperienceRichLinks(currentFile).map((item) => [item.id, item]),
  );
  const restoredItem = {
    id: entryId,
    // A copy, so writing the version's own item into the draft's own array never touches the
    // version's file or the draft's item the version was copied out of.
    attributes: { ...snapshotEntry.attributes },
  } satisfies WebExperienceRichLinkItem;

  const richLinks = (
    merged.data?.data?.[0]?.attributes?.rich_links?.data ?? []
  ).map((item) =>
    item.id === entryId ? restoredItem : (heldById.get(item.id) ?? item),
  ) as Array<WebExperienceRichLinkItem>;

  if (!richLinks.some((item) => item.id === entryId)) {
    // The upsert writes the entry list in position order, so an entry the upsert could not write
    // lands where its saved position puts it, which is where an ordinary save would have put it.
    const positionOf = (item: WebExperienceRichLinkItem) =>
      item.attributes?.position ?? 0;
    const restoredPosition = positionOf(restoredItem);
    const before = richLinks.findIndex(
      (item) => positionOf(item) > restoredPosition,
    );

    if (before === -1) richLinks.push(restoredItem);
    else richLinks.splice(before, 0, restoredItem);
  }

  return {
    ...merged,
    data: {
      ...merged.data,
      data: [
        {
          ...currentPage,
          attributes: {
            ...currentPage.attributes,
            // The page's own attributes and its intro are handed back from the draft. The upsert
            // re-stamped the page and re-wrote the intro from the editor's projection of it, and a
            // restore that left them stamped and re-written would read to the next save exactly as
            // though the intro and the page title had been edited.
            page_details: currentPage.attributes.page_details,
            rich_links: {
              ...currentPage.attributes.rich_links,
              data: richLinks,
            },
          },
        },
      ],
    },
  };
};

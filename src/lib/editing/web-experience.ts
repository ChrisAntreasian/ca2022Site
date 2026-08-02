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

  const richLinks = [...value.entries]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => {
      const existing = entryById.get(entry.id);

      if (!existing) {
        return {
          id: entry.id,
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
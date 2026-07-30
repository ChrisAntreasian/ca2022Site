import { Schema } from "effect";

import { strapiPoemC, type StrapiPoem } from "$lib/typing/poem";

import type { EditorDefinition } from "./definitions";

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

export const poemsFileC: Schema.Schema<PoemsFile, PoemsFile, never> = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: strapiPoemC,
});

export const poemEditorDefinition = {
  key: "poems",
  label: "Poems",
  schema: poemEditorValueC as Schema.Schema<PoemEditorValue, unknown, never>,
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

export const toPoemEditorValues = (file: PoemsFile): ReadonlyArray<PoemEditorValue> =>
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
        pageSize: Math.max(file.data.meta.pagination.pageSize, data.length || 1),
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
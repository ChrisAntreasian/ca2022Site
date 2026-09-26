import { describe, expect, it } from "vitest";

import {
  poemEditorDefinition,
  poemsFileC,
  toPoemEditorValues,
  upsertPoemEditorValue,
  type PoemsFile,
} from "../../src/lib/editing/poems";
import { Schema, Either } from "effect";

describe("poem editor adapter", () => {
  const baseFile: PoemsFile = {
    name: "poems",
    timestamp: 1,
    data: {
      data: [
        {
          id: 4,
          attributes: {
            createdAt: "2023-01-01T00:00:00.000Z",
            updatedAt: "2023-01-01T00:00:00.000Z",
            publishedAt: "2023-01-01T00:00:00.000Z",
            title: "Second",
            body: "Body 2",
            featured: false,
            position: 20,
          },
        },
        {
          id: 2,
          attributes: {
            createdAt: "2023-01-02T00:00:00.000Z",
            updatedAt: "2023-01-02T00:00:00.000Z",
            publishedAt: "2023-01-02T00:00:00.000Z",
            title: "First",
            body: "Body 1",
            featured: true,
            position: 10,
          },
        },
      ],
      meta: {
        pagination: {
          page: 1,
          pageCount: 1,
          pageSize: 25,
          total: 2,
        },
      },
    },
  };

  it("validates the existing poems file wrapper", () => {
    const result = Schema.decodeEither(poemsFileC)(baseFile);

    expect(Either.isRight(result)).toBe(true);
  });

  it("maps strapi-shaped poems into canonical editor values", () => {
    const result = toPoemEditorValues(baseFile);

    expect(result).toEqual([
      {
        id: 2,
        title: "First",
        bodyMarkdown: "Body 1",
        sortOrder: 10,
      },
      {
        id: 4,
        title: "Second",
        bodyMarkdown: "Body 2",
        sortOrder: 20,
      },
    ]);
  });

  it("upserts an existing poem back into the current file shape", () => {
    const updated = upsertPoemEditorValue(
      baseFile,
      {
        id: 2,
        title: "Updated First",
        bodyMarkdown: "Updated body",
        sortOrder: 15,
      },
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(updated.timestamp).toBe(new Date("2024-01-01T00:00:00.000Z").getTime());
    expect(updated.data.data?.[0].id).toBe(2);
    expect(updated.data.data?.[0].attributes.title).toBe("Updated First");
    expect(updated.data.data?.[0].attributes.position).toBe(15);
    expect(updated.data.data?.[0].attributes.featured).toBe(true);
    expect(updated.data.data?.[0].attributes.createdAt).toBe("2023-01-02T00:00:00.000Z");
    expect(updated.data.data?.[0].attributes.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("creates a new poem with the next id", () => {
    const updated = upsertPoemEditorValue(
      baseFile,
      {
        id: 0,
        title: "New Poem",
        bodyMarkdown: "New body",
        sortOrder: 5,
      },
      new Date("2024-01-02T00:00:00.000Z"),
    );

    expect(updated.data.data).toHaveLength(3);
    expect(updated.data.data?.[0].id).toBe(5);
    expect(updated.data.data?.[0].attributes.title).toBe("New Poem");
    expect(updated.data.data?.[0].attributes.featured).toBe(false);
    expect(updated.data.meta.pagination.total).toBe(3);
  });

  it("defines a config-driven editor for poems", () => {
    expect(poemEditorDefinition.key).toBe("poems");
    expect(poemEditorDefinition.fields.map((field) => field.name)).toEqual([
      "title",
      "bodyMarkdown",
      "sortOrder",
    ]);
    expect(poemEditorDefinition.createDefault().sortOrder).toBe(10);
  });

  it("preserves the original file timestamp when creating the first snapshot", () => {
    expect(baseFile.timestamp).toBe(1);
    expect(baseFile.name).toBe("poems");
  });
});
import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";

import {
  toWebExperienceEditorValue,
  upsertWebExperienceEditorValue,
  webExperienceEditorDefinition,
  webExperienceFileC,
  type WebExperienceFile,
} from "../../src/lib/editing/web-experience";
import {
  mergeWebExperienceValue,
  parseWebExperienceEditorParam,
  parseWebExperienceForm,
  selectWebExperienceTarget,
  webExperienceEditorPath,
} from "../../src/routes/web-experience/edit/editor";

describe("web experience editor adapter", () => {
  const baseFile: WebExperienceFile = {
    name: "web-experience",
    timestamp: 1,
    data: {
      data: [
        {
          id: 3,
          attributes: {
            createdAt: "2023-01-01T00:00:00.000Z",
            updatedAt: "2023-01-01T00:00:00.000Z",
            publishedAt: "2023-01-01T00:00:00.000Z",
            title: "Web Experience",
            page_details: {
              data: [
                {
                  id: 30,
                  attributes: {
                    createdAt: "2023-01-01T00:00:00.000Z",
                    updatedAt: "2023-01-01T00:00:00.000Z",
                    publishedAt: "2023-01-01T00:00:00.000Z",
                    title: "Web Development",
                    description: "Intro copy",
                    art_categories: undefined,
                    poems: undefined,
                    link: null,
                    art_piece: undefined,
                    image: undefined,
                  },
                },
              ],
            },
            rich_links: {
              data: [
                {
                  id: 2,
                  attributes: {
                    createdAt: "2023-01-01T00:00:00.000Z",
                    updatedAt: "2023-01-01T00:00:00.000Z",
                    publishedAt: "2023-01-01T00:00:00.000Z",
                    title: "BondLink",
                    body: "Body one",
                    image: {
                      data: [
                        {
                          id: 100,
                          attributes: {
                            alternativeText: "shot",
                            caption: "shot",
                            createdAt: "2023-01-01T00:00:00.000Z",
                            updatedAt: "2023-01-01T00:00:00.000Z",
                            ext: ".jpg",
                            hash: "hash",
                            height: 100,
                            mime: "image/jpeg",
                            name: "shot.jpg",
                            previewUrl: null,
                            provider: "aws-s3",
                            provider_metadata: null,
                            size: 1,
                            url: "/shot.jpg",
                            width: 100,
                            formats: null,
                          },
                        },
                      ],
                    },
                    logo: {
                      data: {
                        id: 50,
                        attributes: {
                          alternativeText: "logo",
                          caption: "logo",
                          createdAt: "2023-01-01T00:00:00.000Z",
                          updatedAt: "2023-01-01T00:00:00.000Z",
                          ext: ".svg",
                          hash: "logo-hash",
                          height: 60,
                          mime: "image/svg+xml",
                          name: "logo.svg",
                          previewUrl: null,
                          provider: "aws-s3",
                          provider_metadata: null,
                          size: 1,
                          url: "/logo.svg",
                          width: 200,
                          formats: null,
                        },
                      },
                    },
                    link: "https://bondlink.com",
                    secondLink: null,
                    position: 10,
                  },
                },
              ],
            },
          },
        },
      ],
      meta: {
        pagination: {
          page: 1,
          pageCount: 1,
          pageSize: 25,
          total: 1,
        },
      },
    },
  };

  it("validates the web experience file wrapper", () => {
    const result = Schema.decodeEither(webExperienceFileC)(baseFile);

    expect(Either.isRight(result)).toBe(true);
  });

  it("maps the file into canonical editor values", () => {
    expect(toWebExperienceEditorValue(baseFile)).toEqual({
      pageId: 3,
      pageTitle: "Web Experience",
      introId: 30,
      introTitle: "Web Development",
      introBodyMarkdown: "Intro copy",
      entries: [
        {
          id: 2,
          title: "BondLink",
          bodyMarkdown: "Body one",
          primaryLink: "https://bondlink.com",
          secondaryLink: null,
          sortOrder: 10,
        },
      ],
    });
  });

  it("preserves logo and screenshot assets when text fields are updated", () => {
    const updated = upsertWebExperienceEditorValue(
      baseFile,
      {
        pageId: 3,
        pageTitle: "Web Experience Updated",
        introId: 30,
        introTitle: "Web Development Updated",
        introBodyMarkdown: "New intro copy",
        entries: [
          {
            id: 2,
            title: "BondLink Updated",
            bodyMarkdown: "Updated body",
            primaryLink: "https://bondlink.com/work",
            secondaryLink: "https://backup.example.com",
            sortOrder: 15,
          },
        ],
      },
      new Date("2024-01-01T00:00:00.000Z"),
    );

    const entry = updated.data.data?.[0].attributes.rich_links?.data?.[0];
    expect(updated.data.data?.[0].attributes.title).toBe("Web Experience Updated");
    expect(updated.data.data?.[0].attributes.page_details.data[0].attributes.title).toBe(
      "Web Development Updated",
    );
    expect(entry?.attributes.title).toBe("BondLink Updated");
    expect(entry?.attributes.position).toBe(15);
    expect(entry?.attributes.logo.data?.attributes.url).toBe("/logo.svg");
    expect(entry?.attributes.image.data[0].attributes.url).toBe("/shot.jpg");
  });

  it("defines a reusable editor contract for the web experience page", () => {
    expect(webExperienceEditorDefinition.key).toBe("web-experience");
    expect(webExperienceEditorDefinition.fields.map((field) => field.name)).toEqual([
      "pageTitle",
      "introTitle",
      "introBodyMarkdown",
    ]);
    expect(webExperienceEditorDefinition.createDefault().entries).toEqual([]);
  });

  it("builds and parses editor routes for intro and entry targets", () => {
    expect(webExperienceEditorPath({ kind: "intro" })).toBe("/web-experience/edit/intro");
    expect(webExperienceEditorPath({ kind: "entry", id: 7 }, "BondLink Work")).toBe(
      "/web-experience/edit/7/bondlink-work",
    );
    expect(parseWebExperienceEditorParam("intro")).toEqual({ kind: "intro" });
    expect(parseWebExperienceEditorParam("7")).toEqual({ kind: "entry", id: 7 });
    expect(parseWebExperienceEditorParam("not-a-number")).toBeNull();
  });

  it("selects and merges editor values for intro and entry forms", () => {
    const value = toWebExperienceEditorValue(baseFile);
    const introTarget = selectWebExperienceTarget(value, { kind: "intro" });
    const entryTarget = selectWebExperienceTarget(value, { kind: "entry", id: 2 });

    expect(introTarget).toEqual({
      kind: "intro",
      title: "Web Development",
      bodyMarkdown: "Intro copy",
      pageTitle: "Web Experience",
    });
    expect(entryTarget).toEqual({
      kind: "entry",
      id: 2,
      title: "BondLink",
      bodyMarkdown: "Body one",
      primaryLink: "https://bondlink.com",
      secondaryLink: null,
      sortOrder: 10,
    });

    const formData = new FormData();
    formData.set("kind", "entry");
    formData.set("id", "2");
    formData.set("title", "Updated entry");
    formData.set("bodyMarkdown", "Updated body");
    formData.set("primaryLink", "https://updated.example");
    formData.set("secondaryLink", "https://backup.example");
    formData.set("sortOrder", "5");

    const merged = mergeWebExperienceValue(value, parseWebExperienceForm(formData));

    expect(merged.entries[0]).toMatchObject({
      id: 2,
      title: "Updated entry",
      bodyMarkdown: "Updated body",
      primaryLink: "https://updated.example",
      secondaryLink: "https://backup.example",
      sortOrder: 5,
    });
  });
});
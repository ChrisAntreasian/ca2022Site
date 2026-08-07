import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";

import {
  applyWebExperienceMediaPatch,
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

  it("replaces logo and screenshots when upload media patch is applied", () => {
    const patched = applyWebExperienceMediaPatch(
      baseFile,
      {
        entryId: 2,
        logo: {
          name: "new-logo.svg",
          mime: "image/svg+xml",
          size: 2048,
          url: "/uploads/web-experience/new-logo.svg",
        },
        images: [
          {
            name: "shot-1.jpg",
            mime: "image/jpeg",
            size: 5120,
            url: "/uploads/web-experience/shot-1.jpg",
          },
          {
            name: "shot-2.jpg",
            mime: "image/jpeg",
            size: 6144,
            url: "/uploads/web-experience/shot-2.jpg",
          },
        ],
      },
      new Date("2024-01-02T00:00:00.000Z"),
    );

    const entry = patched.data.data?.[0].attributes.rich_links?.data?.[0];
    expect(entry?.attributes.logo.data?.attributes.url).toBe(
      "/uploads/web-experience/new-logo.svg",
    );
    expect(entry?.attributes.logo.data?.attributes.provider).toBe("local");
    expect(entry?.attributes.image.data.length).toBe(2);
    expect(entry?.attributes.image.data[0].attributes.formats.small.url).toBe(
      "/uploads/web-experience/shot-1.jpg",
    );
    expect(entry?.attributes.image.data[1].attributes.formats.thumbnail.url).toBe(
      "/uploads/web-experience/shot-2.jpg",
    );
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
    expect(webExperienceEditorPath({ kind: "new" })).toBe("/web-experience/edit/new");
    expect(webExperienceEditorPath({ kind: "entry", id: 7 }, "BondLink Work")).toBe(
      "/web-experience/edit/7/bondlink-work",
    );
    expect(parseWebExperienceEditorParam("intro")).toEqual({ kind: "intro" });
    expect(parseWebExperienceEditorParam("new")).toEqual({ kind: "new" });
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

  it("creates a new entry from new selection and assigns an id on upsert", () => {
    const value = toWebExperienceEditorValue(baseFile);
    const newTarget = selectWebExperienceTarget(value, { kind: "new" });

    expect(newTarget).toMatchObject({
      kind: "entry",
      id: 0,
      title: "",
      bodyMarkdown: "",
      primaryLink: "",
      secondaryLink: null,
    });

    const formData = new FormData();
    formData.set("kind", "entry");
    formData.set("id", "0");
    formData.set("title", "Brand new experience");
    formData.set("bodyMarkdown", "new body");
    formData.set("primaryLink", "https://new.example");
    formData.set("secondaryLink", "");
    formData.set("sortOrder", "25");

    const merged = mergeWebExperienceValue(value, parseWebExperienceForm(formData));
    const saved = upsertWebExperienceEditorValue(
      baseFile,
      merged,
      new Date("2024-01-03T00:00:00.000Z"),
    );
    const richLinks = saved.data.data?.[0].attributes.rich_links?.data ?? [];

    const created = richLinks.find(
      (entry: (typeof richLinks)[number]) =>
        entry.attributes.title === "Brand new experience",
    );

    expect(created).toBeTruthy();
    expect(created?.id).toBeGreaterThan(0);
    expect(created?.attributes.link).toBe("https://new.example");
  });
});
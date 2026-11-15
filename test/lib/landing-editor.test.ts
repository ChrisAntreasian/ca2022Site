import { describe, expect, it } from "vitest";

import {
  toLandingEditorValue,
  upsertLandingEditorValue,
  type LandingFile,
} from "../../src/lib/editing/resources/landing/landing";
import {
  landingEditorPath,
  parseLandingEditorParam,
  parseLandingSectionForm,
  selectLandingSection,
} from "../../src/lib/editing/resources/landing/landing-editor";

const baseFile = (): LandingFile => ({
  name: "landing",
  timestamp: 1000,
  data: {
    data: [
      {
        id: 1,
        attributes: {
          title: "Home",
          page_details: {
            data: [
              {
                id: 5,
                attributes: {
                  title: "Welcome!",
                  description: "I'm Christopher Antreasian.",
                  link: null,
                },
              },
              {
                id: 6,
                attributes: {
                  title: "Poems",
                  description: "Read my poems.",
                  link: "/poems",
                },
              },
            ],
          },
        },
      },
    ],
  },
});

describe("landing editor value mapping", () => {
  it("maps every page section into the editor value with empty-string links", () => {
    expect(toLandingEditorValue(baseFile())).toEqual({
      sections: [
        {
          id: 5,
          title: "Welcome!",
          description: "I'm Christopher Antreasian.",
          link: "",
        },
        {
          id: 6,
          title: "Poems",
          description: "Read my poems.",
          link: "/poems",
        },
      ],
    });
  });

  it("writes a section edit back by id while preserving untouched sections", () => {
    // A realistic landing file where the intro also carries a media record that the editor must not drop.
    const fileWithImage = {
      ...baseFile(),
      data: {
        data: [
          {
            id: 1,
            attributes: {
              title: "Home",
              page_details: {
                data: [
                  {
                    id: 5,
                    attributes: {
                      title: "Welcome!",
                      description: "I'm Christopher Antreasian.",
                      link: null,
                      image: { data: { attributes: { url: "a.png" } } },
                    },
                  },
                  {
                    id: 6,
                    attributes: {
                      title: "Poems",
                      description: "Read my poems.",
                      link: "/poems",
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    } as unknown as LandingFile;

    const updated = upsertLandingEditorValue(
      fileWithImage,
      {
        sections: [
          {
            id: 5,
            title: "Welcome!",
            description: "Updated intro.",
            link: "",
          },
        ],
      },
      new Date(2000),
    );

    expect(updated.timestamp).toBe(2000);
    const sections = updated.data.data[0].attributes.page_details.data;
    const intro = sections.find((section) => section.id === 5);
    const poemLink = sections.find((section) => section.id === 6);

    expect(intro?.attributes.description).toBe("Updated intro.");
    // Empty link string maps back to null.
    expect(intro?.attributes.link).toBeNull();
    // Untouched fields survive the edit: id 6 is untouched, and the intro's media record is preserved.
    expect(poemLink?.attributes.title).toBe("Poems");
    expect(poemLink?.attributes.link).toBe("/poems");
    const introAttributes = intro?.attributes as Record<string, unknown>;
    expect(introAttributes.image).toEqual({
      data: { attributes: { url: "a.png" } },
    });
  });
});

describe("landing edit route helpers", () => {
  it("builds a per-section editor path", () => {
    expect(landingEditorPath(5)).toBe("/landing/edit/5");
  });

  it("parses the section id param, rejecting non-positive values", () => {
    expect(parseLandingEditorParam("5")).toBe(5);
    expect(parseLandingEditorParam("0")).toBeNull();
    expect(parseLandingEditorParam("abc")).toBeNull();
  });

  it("selects a section by id and offers a blank section for the new slot", () => {
    const value = toLandingEditorValue(baseFile());

    expect(selectLandingSection(value, 6)?.title).toBe("Poems");
    expect(selectLandingSection(value, 99)).toBeNull();
    expect(selectLandingSection(value, 0)).toEqual({
      id: 0,
      title: "",
      description: "",
      link: "",
    });
  });

  it("parses a section form and trims the link", () => {
    const formData = new FormData();
    formData.set("id", "6");
    formData.set("title", "Poems");
    formData.set("description", "Read my poems.");
    formData.set("link", "  /poems  ");

    expect(parseLandingSectionForm(formData)).toEqual({
      id: 6,
      title: "Poems",
      description: "Read my poems.",
      link: "/poems",
    });
  });
});

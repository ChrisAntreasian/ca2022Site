import { describe, expect, it } from "vitest";

import {
  parsePoemEditorParam,
  parsePoemForm,
  poemEditorPath,
  selectPoem,
} from "../../src/routes/poems/edit/editor";

describe("poems edit route helpers", () => {
  it("builds slug-aware editor paths", () => {
    expect(poemEditorPath("new")).toBe("/poems/edit/new");
    expect(poemEditorPath(4)).toBe("/poems/edit/4");
    expect(poemEditorPath(4, "The Carpal Tunnel")).toBe(
      "/poems/edit/4/the-carpal-tunnel",
    );
  });

  it("parses new, id-only, and id-plus-slug params", () => {
    expect(parsePoemEditorParam("new")).toBe(0);
    expect(parsePoemEditorParam("4")).toBe(4);
    expect(parsePoemEditorParam("4/the-carpal-tunnel")).toBe(4);
  });

  it("returns null for invalid edit params", () => {
    expect(parsePoemEditorParam("")).toBeNull();
    expect(parsePoemEditorParam("abc")).toBeNull();
    expect(parsePoemEditorParam("0/nope")).toBeNull();
  });

  it("parses form data into the canonical editor shape", () => {
    const formData = new FormData();
    formData.set("id", "4");
    formData.set("title", "The Carpal Tunnel");
    formData.set("bodyMarkdown", "Body text");
    formData.set("sortOrder", "20");

    expect(parsePoemForm(formData)).toEqual({
      id: 4,
      title: "The Carpal Tunnel",
      bodyMarkdown: "Body text",
      sortOrder: 20,
    });
  });

  it("selects an existing poem or returns a default for new", () => {
    const createDefault = () => ({
      id: 0,
      title: "",
      bodyMarkdown: "",
      sortOrder: 10,
    });

    const poems = [
      { id: 2, title: "Cheese", bodyMarkdown: "A", sortOrder: 10 },
      { id: 4, title: "The Carpal Tunnel", bodyMarkdown: "B", sortOrder: 20 },
    ];

    expect(selectPoem(poems, 4, createDefault)?.title).toBe("The Carpal Tunnel");
    expect(selectPoem(poems, 0, createDefault)).toEqual(createDefault());
    expect(selectPoem(poems, 999, createDefault)).toBeNull();
  });
});
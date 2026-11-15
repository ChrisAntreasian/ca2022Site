import { describe, expect, it } from "vitest";

import {
  toLayoutEditorValue,
  upsertLayoutEditorValue,
  type LayoutFile,
} from "../../src/lib/editing/resources/layout/layout";
import {
  layoutEditorPath,
  parseLayoutForm,
} from "../../src/lib/editing/resources/layout/layout-editor";

const baseFile = (): LayoutFile => ({
  name: "layout",
  timestamp: 1000,
  data: {
    data: [
      {
        id: 6,
        attributes: {
          title: "Christopher Antreasian",
          description: "none",
          link: null,
          image: {
            data: {
              attributes: {
                url: "https://cdn.example.com/logo.png",
              },
            },
          },
        },
      },
    ],
  },
});

describe("layout editor value mapping", () => {
  it("reads the header title and logo URL out of the file", () => {
    expect(toLayoutEditorValue(baseFile())).toEqual({
      title: "Christopher Antreasian",
      logoUrl: "https://cdn.example.com/logo.png",
    });
  });

  it("falls back to defaults when the entry is missing", () => {
    const empty: LayoutFile = {
      name: "layout",
      timestamp: 0,
      data: { data: [] },
    };

    expect(toLayoutEditorValue(empty)).toEqual({ title: "", logoUrl: "" });
  });

  it("replaces only the editable fields and preserves everything else", () => {
    const updated = upsertLayoutEditorValue(
      baseFile(),
      { title: "Chris A.", logoUrl: "https://cdn.example.com/new.png" },
      new Date(2000),
    );

    expect(updated.timestamp).toBe(2000);
    const entry = updated.data.data[0];
    expect(entry.attributes.title).toBe("Chris A.");
    expect(entry.attributes.image.data.attributes.url).toBe(
      "https://cdn.example.com/new.png",
    );
    // Untouched fields survive the edit.
    expect(entry.id).toBe(6);
    expect(entry.attributes.description).toBe("none");
  });
});

describe("layout edit route helpers", () => {
  it("builds the layout editor path", () => {
    expect(layoutEditorPath()).toBe("/layout/edit");
  });

  it("parses form data into the editor value and trims the logo URL", () => {
    const formData = new FormData();
    formData.set("title", "Chris A.");
    formData.set("logoUrl", "  https://cdn.example.com/logo.png  ");

    expect(parseLayoutForm(formData)).toEqual({
      title: "Chris A.",
      logoUrl: "https://cdn.example.com/logo.png",
    });
  });
});

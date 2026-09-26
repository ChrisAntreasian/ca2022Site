import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPoems = [
  { id: 2, title: "Cheese", bodyMarkdown: "Cheese body", sortOrder: 10 },
  { id: 4, title: "The Carpal Tunnel", bodyMarkdown: "Tunnel body", sortOrder: 20 },
];

const mockSavedFile = {
  data: {
    data: [
      {
        id: 4,
        attributes: { title: "The Carpal Tunnel" },
      },
      {
        id: 2,
        attributes: { title: "Cheese" },
      },
    ],
  },
};

describe("poems edit page server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads the selected poem and saved message", async () => {
    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/poems", () => ({
      poemEditorDefinition: {
        key: "poems",
        label: "Poems",
        fields: [],
        createDefault: () => ({ id: 0, title: "", bodyMarkdown: "", sortOrder: 10 }),
        schema: {},
      },
      toPoemEditorValues: vi.fn(() => mockPoems),
    }));

    vi.doMock("$lib/editing/poems.server", () => ({
      ensurePoemsBaselineSnapshot: vi.fn(),
      readPoemsFile: vi.fn(async () => ({ name: "poems" })),
      savePoemEditorValue: vi.fn(),
    }));

    const { load } = await import("../../src/routes/poems/edit/[...pid]/+page.server");

    const result = await load({
      params: { pid: "4/the-carpal-tunnel" },
      url: new URL("http://localhost/poems/edit/4/the-carpal-tunnel?saved=1"),
    } as never);

    expect(result.editorEnabled).toBe(true);
    expect(result.savedMessage).toBe("Poem saved.");
    expect(result.editor.newPath).toBe("/poems/edit/new");
    expect(result.selectedPoem.title).toBe("The Carpal Tunnel");
  });

  it("redirects saved poems to slugged edit routes with saved=1", async () => {
    vi.doMock("@sveltejs/kit", async () => {
      const actual = await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
      return {
        ...actual,
        redirect: (status: number, location: string) => {
          throw { status, location };
        },
      };
    });

    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/poems", () => ({
      poemEditorDefinition: {
        key: "poems",
        label: "Poems",
        fields: [],
        createDefault: () => ({ id: 0, title: "", bodyMarkdown: "", sortOrder: 10 }),
        schema: {},
      },
      toPoemEditorValues: vi.fn(() => mockPoems),
    }));

    vi.doMock("effect", async () => {
      const actual = await vi.importActual<typeof import("effect")>("effect");
      return {
        ...actual,
        Schema: {
          ...actual.Schema,
          decodeUnknownEither: () => () => ({ _tag: "Right", right: {
            id: 4,
            title: "The Carpal Tunnel",
            bodyMarkdown: "Tunnel body",
            sortOrder: 20,
          } }),
        },
      };
    });

    vi.doMock("$lib/editing/poems.server", () => ({
      ensurePoemsBaselineSnapshot: vi.fn(),
      readPoemsFile: vi.fn(),
      savePoemEditorValue: vi.fn(async () => mockSavedFile),
    }));

    const { actions } = await import("../../src/routes/poems/edit/[...pid]/+page.server");
    const formData = new FormData();
    formData.set("id", "4");
    formData.set("title", "The Carpal Tunnel");
    formData.set("bodyMarkdown", "Tunnel body");
    formData.set("sortOrder", "20");

    await expect(
      actions.save({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/poems/edit/4/the-carpal-tunnel?saved=1",
    });
  });

  it("respects redirectTo during save-and-continue", async () => {
    vi.doMock("@sveltejs/kit", async () => {
      const actual = await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
      return {
        ...actual,
        redirect: (status: number, location: string) => {
          throw { status, location };
        },
      };
    });

    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/poems", () => ({
      poemEditorDefinition: {
        key: "poems",
        label: "Poems",
        fields: [],
        createDefault: () => ({ id: 0, title: "", bodyMarkdown: "", sortOrder: 10 }),
        schema: {},
      },
      toPoemEditorValues: vi.fn(() => mockPoems),
    }));

    vi.doMock("effect", async () => {
      const actual = await vi.importActual<typeof import("effect")>("effect");
      return {
        ...actual,
        Schema: {
          ...actual.Schema,
          decodeUnknownEither: () => () => ({ _tag: "Right", right: {
            id: 4,
            title: "The Carpal Tunnel",
            bodyMarkdown: "Tunnel body",
            sortOrder: 20,
          } }),
        },
      };
    });

    vi.doMock("$lib/editing/poems.server", () => ({
      ensurePoemsBaselineSnapshot: vi.fn(),
      readPoemsFile: vi.fn(),
      savePoemEditorValue: vi.fn(async () => mockSavedFile),
    }));

    const { actions } = await import("../../src/routes/poems/edit/[...pid]/+page.server");
    const formData = new FormData();
    formData.set("id", "4");
    formData.set("title", "The Carpal Tunnel");
    formData.set("bodyMarkdown", "Tunnel body");
    formData.set("sortOrder", "20");
    formData.set("redirectTo", "/poems/edit/2/cheese");

    await expect(
      actions.save({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/poems/edit/2/cheese?saved=1",
    });
  });

  it("deletes a poem and redirects to the next remaining poem", async () => {
    vi.doMock("@sveltejs/kit", async () => {
      const actual = await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
      return {
        ...actual,
        redirect: (status: number, location: string) => {
          throw { status, location };
        },
      };
    });

    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    const toPoemEditorValues = vi
      .fn()
      .mockReturnValueOnce(mockPoems)
      .mockReturnValueOnce([mockPoems[1]]);
    const deletePoemEditorValue = vi.fn(async () => ({ name: "poems" }));

    vi.doMock("$lib/editing/poems", () => ({
      poemEditorDefinition: {
        key: "poems",
        label: "Poems",
        fields: [],
        createDefault: () => ({ id: 0, title: "", bodyMarkdown: "", sortOrder: 10 }),
        schema: {},
      },
      toPoemEditorValues,
    }));

    vi.doMock("$lib/editing/poems.server", () => ({
      deletePoemEditorValue,
      ensurePoemsBaselineSnapshot: vi.fn(),
      readPoemsFile: vi.fn(async () => ({ name: "poems" })),
      savePoemEditorValue: vi.fn(async () => mockSavedFile),
    }));

    const { actions } = await import("../../src/routes/poems/edit/[...pid]/+page.server");
    const formData = new FormData();
    formData.set("id", "2");

    await expect(
      actions.delete({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/poems/edit/4/the-carpal-tunnel?deleted=1",
    });

    expect(deletePoemEditorValue).toHaveBeenCalledWith(2, expect.any(Date), { name: "poems" });
  });

  it("rejects poem delete for invalid id", async () => {
    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/poems", () => ({
      poemEditorDefinition: {
        key: "poems",
        label: "Poems",
        fields: [],
        createDefault: () => ({ id: 0, title: "", bodyMarkdown: "", sortOrder: 10 }),
        schema: {},
      },
      toPoemEditorValues: vi.fn(() => mockPoems),
    }));

    vi.doMock("$lib/editing/poems.server", () => ({
      deletePoemEditorValue: vi.fn(),
      ensurePoemsBaselineSnapshot: vi.fn(),
      readPoemsFile: vi.fn(async () => ({ name: "poems" })),
      savePoemEditorValue: vi.fn(async () => mockSavedFile),
    }));

    const { actions } = await import("../../src/routes/poems/edit/[...pid]/+page.server");
    const formData = new FormData();
    formData.set("id", "0");

    const result = await actions.delete({
      request: { formData: async () => formData },
    } as never);

    expect(result).toMatchObject({
      status: 400,
      data: {
        action: "delete",
      },
    });
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEntries = [
  {
    id: 2,
    title: "Entry Two",
    createdDate: "2024-02-01",
    medium: "ink",
    description: "Second entry",
    sortOrder: 20,
    imageUrl: null,
  },
  {
    id: 4,
    title: "Entry Four",
    createdDate: "2024-04-01",
    medium: "oil",
    description: "Fourth entry",
    sortOrder: 10,
    imageUrl: null,
  },
];

const mockFile = {
  name: "the-souljuicer",
  timestamp: 1,
  data: {
    data: [],
    meta: {
      pagination: {
        page: 1,
        pageSize: 25,
        pageCount: 0,
        total: 0,
      },
    },
  },
};

describe("SoulJuicer edit page server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads the selected entry and saved message", async () => {
    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer", () => ({
      toSouljuicerEditorValue: vi.fn(() => ({ entries: mockEntries })),
    }));

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer.server", () => ({
      ensureSouljuicerBaselineSnapshot: vi.fn(),
      readSouljuicerFile: vi.fn(async () => mockFile),
      replaceSouljuicerEntryImage: vi.fn(),
      saveSouljuicerEditorValue: vi.fn(),
    }));

    const { load } = await import("../../src/routes/the-souljuicer/edit/[...aid]/+page.server");
    const result = await load({
      params: { aid: "4" },
      url: new URL("http://localhost/the-souljuicer/edit/4?saved=1"),
    } as never);

    expect(result.editorEnabled).toBe(true);
    expect(result.savedMessage).toBe("Souljuicer entry saved.");
    expect(result.selectedEntry.id).toBe(4);
    expect(result.selectedEntry.title).toBe("Entry Four");
    expect(result.entries).toHaveLength(2);
  });

  it("persists the expanded metadata fields when saving", async () => {
    vi.doMock("@sveltejs/kit", async () => {
      const actual = await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
      return {
        ...actual,
        redirect: (status: number, location: string) => {
          throw { status, location };
        },
      };
    });

    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    const saveSouljuicerEditorValue = vi.fn(async () => mockFile);

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer", () => ({
      toSouljuicerEditorValue: vi.fn(() => ({ entries: mockEntries })),
    }));

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer.server", () => ({
      ensureSouljuicerBaselineSnapshot: vi.fn(),
      persistSouljuicerUpload: vi.fn(),
      readSouljuicerFile: vi.fn(async () => mockFile),
      replaceSouljuicerEntryImage: vi.fn(),
      saveSouljuicerEditorValue,
    }));

    const { actions } = await import("../../src/routes/the-souljuicer/edit/[...aid]/+page.server");
    const formData = new FormData();
    formData.set("id", "4");
    formData.set("title", "Updated Entry Four");
    formData.set("createdDate", "2024-05-01");
    formData.set("medium", "watercolor");
    formData.set("description", "Updated fourth entry");
    formData.set("sortOrder", "15");

    await expect(
      actions.save({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/the-souljuicer/edit/4?saved=1",
    });

    expect(saveSouljuicerEditorValue).toHaveBeenCalledTimes(1);
    expect(saveSouljuicerEditorValue.mock.calls[0][0].entries[1]).toMatchObject({
      id: 4,
      title: "Updated Entry Four",
      createdDate: "2024-05-01",
      medium: "watercolor",
      description: "Updated fourth entry",
      sortOrder: 15,
    });
  });

  it("deletes an entry and redirects to the next remaining entry", async () => {
    vi.doMock("@sveltejs/kit", async () => {
      const actual = await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
      return {
        ...actual,
        redirect: (status: number, location: string) => {
          throw { status, location };
        },
      };
    });

    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    const deleteSouljuicerEntry = vi.fn(async () => mockFile);
    const toSouljuicerEditorValue = vi
      .fn()
      .mockReturnValueOnce({ entries: mockEntries })
      .mockReturnValueOnce({ entries: [mockEntries[0]] });

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer", () => ({
      toSouljuicerEditorValue,
    }));

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer.server", () => ({
      deleteSouljuicerEntry,
      ensureSouljuicerBaselineSnapshot: vi.fn(),
      persistSouljuicerUpload: vi.fn(),
      readSouljuicerFile: vi.fn(async () => mockFile),
      replaceSouljuicerEntryImage: vi.fn(),
      saveSouljuicerEditorValue: vi.fn(async () => mockFile),
    }));

    const { actions } = await import("../../src/routes/the-souljuicer/edit/[...aid]/+page.server");
    const formData = new FormData();
    formData.set("id", "4");

    await expect(
      actions.delete({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/the-souljuicer/edit/2?deleted=1",
    });

    expect(deleteSouljuicerEntry).toHaveBeenCalledWith(4, expect.any(Date), mockFile);
  });

  it("blocks deleting the final remaining entry", async () => {
    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer", () => ({
      toSouljuicerEditorValue: vi.fn(() => ({ entries: [mockEntries[0]] })),
    }));

    vi.doMock("$lib/editing/resources/souljuicer/souljuicer.server", () => ({
      deleteSouljuicerEntry: vi.fn(),
      ensureSouljuicerBaselineSnapshot: vi.fn(),
      persistSouljuicerUpload: vi.fn(),
      readSouljuicerFile: vi.fn(async () => mockFile),
      replaceSouljuicerEntryImage: vi.fn(),
      saveSouljuicerEditorValue: vi.fn(async () => mockFile),
    }));

    const { actions } = await import("../../src/routes/the-souljuicer/edit/[...aid]/+page.server");
    const formData = new FormData();
    formData.set("id", "2");

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

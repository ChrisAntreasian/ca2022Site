import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEntries = [
  {
    id: 3,
    title: "Panel Three",
    description: "Third",
    createdDate: "2024-03-01",
    medium: "ink",
    sortOrder: 30,
    imageUrl: null,
  },
  {
    id: 5,
    title: "Panel Five",
    description: "Fifth",
    createdDate: "2024-05-01",
    medium: "watercolor",
    sortOrder: 10,
    imageUrl: null,
  },
];

const mockFile = {
  name: "the-quintuplapus",
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

describe("Quintuplapus edit page server delete", () => {
  beforeEach(() => {
    vi.resetModules();
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

    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    const deleteQuintuplapusEntry = vi.fn(async () => mockFile);
    const toQuintuplapusEditorValue = vi
      .fn()
      .mockReturnValueOnce({ categoryTitle: "Cat", entries: mockEntries })
      .mockReturnValueOnce({ categoryTitle: "Cat", entries: [mockEntries[0]] });

    vi.doMock("$lib/editing/quintuplapus", () => ({
      toQuintuplapusEditorValue,
    }));

    vi.doMock("$lib/editing/quintuplapus.server", () => ({
      deleteQuintuplapusEntry,
      ensureQuintuplapusBaselineSnapshot: vi.fn(),
      persistQuintuplapusUpload: vi.fn(),
      readQuintuplapusFile: vi.fn(async () => mockFile),
      replaceQuintuplapusEntryImage: vi.fn(),
      saveQuintuplapusEditorValue: vi.fn(async () => mockFile),
    }));

    const { actions } = await import("../../src/routes/the-quintuplapus/edit/[...aid]/+page.server");
    const formData = new FormData();
    formData.set("id", "5");

    await expect(
      actions.delete({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/the-quintuplapus/edit/3/panel-three?saved=1",
    });

    expect(deleteQuintuplapusEntry).toHaveBeenCalledWith(5, expect.any(Date), mockFile);
  });

  it("blocks deleting the final remaining entry", async () => {
    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/quintuplapus", () => ({
      toQuintuplapusEditorValue: vi.fn(() => ({ categoryTitle: "Cat", entries: [mockEntries[0]] })),
    }));

    vi.doMock("$lib/editing/quintuplapus.server", () => ({
      deleteQuintuplapusEntry: vi.fn(),
      ensureQuintuplapusBaselineSnapshot: vi.fn(),
      persistQuintuplapusUpload: vi.fn(),
      readQuintuplapusFile: vi.fn(async () => mockFile),
      replaceQuintuplapusEntryImage: vi.fn(),
      saveQuintuplapusEditorValue: vi.fn(async () => mockFile),
    }));

    const { actions } = await import("../../src/routes/the-quintuplapus/edit/[...aid]/+page.server");
    const formData = new FormData();
    formData.set("id", "3");

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

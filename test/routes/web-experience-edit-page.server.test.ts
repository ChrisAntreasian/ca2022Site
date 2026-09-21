import { beforeEach, describe, expect, it, vi } from "vitest";

describe("web experience edit page server delete action", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("deletes a saved entry and redirects to another entry", async () => {
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

    const baseValue = {
      pageId: 1,
      pageTitle: "Web",
      introId: 2,
      introTitle: "Intro",
      introBodyMarkdown: "Body",
      entries: [
        { id: 7, title: "BondLink", bodyMarkdown: "A", primaryLink: "https://a", secondaryLink: null, sortOrder: 10 },
        { id: 8, title: "BetterLesson", bodyMarkdown: "B", primaryLink: "https://b", secondaryLink: null, sortOrder: 20 },
      ],
    };

    const toWebExperienceEditorValue = vi
      .fn()
      .mockReturnValueOnce(baseValue)
      .mockReturnValueOnce({
        ...baseValue,
        entries: [
          { id: 8, title: "BetterLesson", bodyMarkdown: "B", primaryLink: "https://b", secondaryLink: null, sortOrder: 20 },
        ],
      });

    const deleteWebExperienceEntry = vi.fn(async () => ({ name: "web-experience" }));

    vi.doMock("$lib/editing/web-experience", () => ({
      applyWebExperienceMediaPatch: vi.fn(),
      buildWebExperienceTarget: vi.fn(),
      toWebExperienceEditorValue,
      webExperienceEditorDefinition: {
        key: "web-experience",
        label: "Web Experience",
      },
    }));

    vi.doMock("$lib/editing/web-experience.server", () => ({
      deleteWebExperienceEntry,
      deleteWebExperienceMedia: vi.fn(),
      ensureWebExperienceBaselineSnapshot: vi.fn(),
      persistWebExperienceUpload: vi.fn(),
      readWebExperienceFile: vi.fn(async () => ({ name: "web-experience" })),
      saveWebExperienceEditorValue: vi.fn(),
      writeWebExperienceFile: vi.fn(),
    }));

    vi.doMock("$lib/editing/web-experience-editor", () => ({
      mergeWebExperienceValue: vi.fn(),
      parseWebExperienceEditorParam: vi.fn(),
      parseWebExperienceForm: vi.fn(() => ({ kind: "entry", id: 7 })),
      selectWebExperienceTarget: vi.fn(),
      webExperienceEditorPath: vi.fn((selection: { kind: string; id?: number }, title?: string) =>
        selection.kind === "entry" && selection.id
          ? `/web-experience/edit/${selection.id}/${String(title).toLowerCase()}`
          : "/web-experience/edit/intro",
      ),
    }));

    const { actions } = await import("../../src/routes/web-experience/edit/[...wid]/+page.server");
    const formData = new FormData();
    formData.set("kind", "entry");
    formData.set("id", "7");

    await expect(
      actions.delete({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/web-experience/edit/8/betterlesson?saved=1",
    });

    expect(deleteWebExperienceEntry).toHaveBeenCalledTimes(1);
    expect(deleteWebExperienceEntry).toHaveBeenCalledWith(7, expect.any(Date), { name: "web-experience" });
  });

  it("rejects delete for intro target", async () => {
    vi.doMock("$lib/editing/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/web-experience", () => ({
      applyWebExperienceMediaPatch: vi.fn(),
      buildWebExperienceTarget: vi.fn(),
      toWebExperienceEditorValue: vi.fn(() => ({
        pageId: 1,
        pageTitle: "Web",
        introId: 2,
        introTitle: "Intro",
        introBodyMarkdown: "Body",
        entries: [],
      })),
      webExperienceEditorDefinition: {
        key: "web-experience",
        label: "Web Experience",
      },
    }));

    vi.doMock("$lib/editing/web-experience.server", () => ({
      deleteWebExperienceEntry: vi.fn(),
      deleteWebExperienceMedia: vi.fn(),
      ensureWebExperienceBaselineSnapshot: vi.fn(),
      persistWebExperienceUpload: vi.fn(),
      readWebExperienceFile: vi.fn(async () => ({ name: "web-experience" })),
      saveWebExperienceEditorValue: vi.fn(),
      writeWebExperienceFile: vi.fn(),
    }));

    vi.doMock("$lib/editing/web-experience-editor", () => ({
      mergeWebExperienceValue: vi.fn(),
      parseWebExperienceEditorParam: vi.fn(),
      parseWebExperienceForm: vi.fn(() => ({ kind: "intro" })),
      selectWebExperienceTarget: vi.fn(),
      webExperienceEditorPath: vi.fn(),
    }));

    const { actions } = await import("../../src/routes/web-experience/edit/[...wid]/+page.server");

    const formData = new FormData();
    formData.set("kind", "intro");

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

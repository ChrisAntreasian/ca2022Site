import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "./fakeCookies";
import { loadResult } from "./loadResult";

describe("layout edit page server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const mockServer = (overrides = {}) => {
    vi.doMock("#lib/editing/core/session.server", () => ({
      requireEditorAccess: vi.fn(),
      isEditorUnlockedForRequest: vi.fn(() => true),
    }));

    vi.doMock("#lib/editing/resources/layout/layout.server", () => ({
      ensureLayoutBaselineSnapshot: vi.fn(),
      readLayoutFile: vi.fn(async () => ({
        name: "layout",
        timestamp: 1,
        data: {
          data: [
            {
              attributes: {
                title: "Christopher Antreasian",
                image: { data: { attributes: { url: "logo.png" } } },
              },
            },
          ],
        },
      })),
      saveLayoutEditorValue: vi.fn(),
      ...overrides,
    }));
  };

  it("loads layout editor data with saved message", async () => {
    mockServer();

    const { load } = await import("../../src/routes/layout/edit/+page.server");
    const result = loadResult(
      await load({
        cookies: fakeCookies(),
        url: new URL("http://localhost/layout/edit?saved=1"),
      } as never),
    );

    expect(result.editorEnabled).toBe(true);
    expect(result.savedMessage).toBe("Site layout saved.");
    expect(result.editor.path).toBe("/layout/edit");
    expect(result.layout.title).toBe("Christopher Antreasian");
    expect(result.layout.logoUrl).toBe("logo.png");
  });

  it("saves layout and redirects with saved=1", async () => {
    vi.doMock("@sveltejs/kit", async () => {
      const actual =
        await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
      return {
        ...actual,
        redirect: (status: number, location: string) => {
          throw { status, location };
        },
      };
    });

    const saveLayoutEditorValue = vi.fn(async () => ({
      name: "layout",
      timestamp: 2,
      data: { data: [] },
    }));
    mockServer({ saveLayoutEditorValue });

    const { actions } =
      await import("../../src/routes/layout/edit/+page.server");
    const formData = new FormData();
    formData.set("title", "Chris A.");
    formData.set("logoUrl", "https://cdn.example.com/logo.png");

    await expect(
      actions.save({
        cookies: fakeCookies(),
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/layout/edit?saved=1",
    });

    expect(saveLayoutEditorValue).toHaveBeenCalledWith({
      title: "Chris A.",
      logoUrl: "https://cdn.example.com/logo.png",
    });
  });

  it("returns validation message when the header title is missing", async () => {
    mockServer();

    const { actions } =
      await import("../../src/routes/layout/edit/+page.server");
    const formData = new FormData();
    formData.set("title", " ");
    formData.set("logoUrl", "");

    const result = await actions.save({
      cookies: fakeCookies(),
      request: { formData: async () => formData },
    } as never);

    expect(result).toMatchObject({
      status: 400,
      data: {
        action: "save",
        message: "Please provide a header title before saving.",
      },
    });
  });
});

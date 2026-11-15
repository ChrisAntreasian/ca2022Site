import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "./fakeCookies";
import { loadResult } from "./loadResult";

describe("landing edit page server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const landingFile = () => ({
    name: "landing",
    timestamp: 1,
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
                    description: "Intro.",
                    link: null,
                  },
                },
                {
                  id: 6,
                  attributes: {
                    title: "Poems",
                    description: "Read.",
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

  const mockServer = (overrides = {}) => {
    vi.doMock("#lib/editing/core/session.server", () => ({
      requireEditorAccess: vi.fn(),
      isEditorUnlockedForRequest: vi.fn(() => true),
    }));

    vi.doMock("#lib/editing/resources/landing/landing.server", () => ({
      ensureLandingBaselineSnapshot: vi.fn(),
      readLandingFile: vi.fn(async () => landingFile()),
      saveLandingSectionEditorValue: vi.fn(),
      ...overrides,
    }));
  };

  it("loads the selected section from the route param", async () => {
    mockServer();

    const { load } =
      await import("../../src/routes/landing/edit/[...sid]/+page.server");
    const result = loadResult(
      await load({
        cookies: fakeCookies(),
        params: { sid: "6" },
        url: new URL("http://localhost/landing/edit/6?saved=1"),
      } as never),
    );

    expect(result.savedMessage).toBe("Home page section saved.");
    expect(result.selectedSection.id).toBe(6);
    expect(result.selectedSection.title).toBe("Poems");
    expect(result.landing.sections.map((s) => s.id)).toEqual([5, 6]);
  });

  it("falls back to the first section when no param is given", async () => {
    mockServer();

    const { load } =
      await import("../../src/routes/landing/edit/[...sid]/+page.server");
    const result = loadResult(
      await load({
        cookies: fakeCookies(),
        params: {},
        url: new URL("http://localhost/landing/edit"),
      } as never),
    );

    expect(result.selectedSection.id).toBe(5);
  });

  it("404s on an unknown section id", async () => {
    mockServer();

    const { load } =
      await import("../../src/routes/landing/edit/[...sid]/+page.server");

    await expect(
      load({
        cookies: fakeCookies(),
        params: { sid: "99" },
        url: new URL("http://localhost/landing/edit/99"),
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("saves a section and redirects with saved=1", async () => {
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

    const saveLandingSectionEditorValue = vi.fn(async () => landingFile());
    mockServer({ saveLandingSectionEditorValue });

    const { actions } =
      await import("../../src/routes/landing/edit/[...sid]/+page.server");
    const formData = new FormData();
    formData.set("id", "6");
    formData.set("title", "Poems");
    formData.set("description", "Read my poems.");
    formData.set("link", "/poems");

    await expect(
      actions.save({
        cookies: fakeCookies(),
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/landing/edit/6?saved=1",
    });

    expect(saveLandingSectionEditorValue).toHaveBeenCalledWith({
      id: 6,
      title: "Poems",
      description: "Read my poems.",
      link: "/poems",
    });
  });

  it("returns validation message when the section title is missing", async () => {
    mockServer();

    const { actions } =
      await import("../../src/routes/landing/edit/[...sid]/+page.server");
    const formData = new FormData();
    formData.set("id", "5");
    formData.set("title", " ");
    formData.set("description", "");

    const result = await actions.save({
      cookies: fakeCookies(),
      request: { formData: async () => formData },
    } as never);

    expect(result).toMatchObject({
      status: 400,
      data: {
        action: "save",
        message: "Please provide a section title before saving.",
      },
    });
  });
});

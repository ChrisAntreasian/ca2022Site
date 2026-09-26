import { beforeEach, describe, expect, it, vi } from "vitest";

describe("terms-of-service edit page server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads terms editor data with saved message", async () => {
    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/resources/terms-of-service/terms-of-service.server", () => ({
      ensureTermsOfServiceBaselineSnapshot: vi.fn(),
      readTermsOfServiceFile: vi.fn(async () => ({
        name: "terms-of-service",
        timestamp: 1,
        data: {
          title: "Terms",
          bodyMarkdown: "Body",
        },
      })),
      saveTermsOfServiceEditorValue: vi.fn(),
    }));

    const { load } = await import("../../src/routes/terms-of-service/edit/+page.server");
    const result = await load({
      url: new URL("http://localhost/terms-of-service/edit?saved=1"),
    } as never);

    expect(result.editorEnabled).toBe(true);
    expect(result.savedMessage).toBe("Terms of service saved.");
    expect(result.editor.path).toBe("/terms-of-service/edit");
    expect(result.terms.title).toBe("Terms");
  });

  it("saves terms and redirects with saved=1", async () => {
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

    const saveTermsOfServiceEditorValue = vi.fn(async () => ({
      name: "terms-of-service",
      timestamp: 2,
      data: {
        title: "AI Terms",
        bodyMarkdown: "No model training.",
      },
    }));

    vi.doMock("$lib/editing/resources/terms-of-service/terms-of-service.server", () => ({
      ensureTermsOfServiceBaselineSnapshot: vi.fn(),
      readTermsOfServiceFile: vi.fn(async () => ({
        name: "terms-of-service",
        timestamp: 1,
        data: {
          title: "Terms",
          bodyMarkdown: "Body",
        },
      })),
      saveTermsOfServiceEditorValue,
    }));

    const { actions } = await import("../../src/routes/terms-of-service/edit/+page.server");
    const formData = new FormData();
    formData.set("title", "AI Terms");
    formData.set("bodyMarkdown", "No model training.");

    await expect(
      actions.save({
        request: { formData: async () => formData },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/terms-of-service/edit?saved=1",
    });

    expect(saveTermsOfServiceEditorValue).toHaveBeenCalledTimes(1);
    expect(saveTermsOfServiceEditorValue).toHaveBeenCalledWith(
      {
        title: "AI Terms",
        bodyMarkdown: "No model training.",
      },
    );
  });

  it("returns validation message when required fields are missing", async () => {
    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
      requireEditorEnabled: vi.fn(),
    }));

    vi.doMock("$lib/editing/resources/terms-of-service/terms-of-service.server", () => ({
      ensureTermsOfServiceBaselineSnapshot: vi.fn(),
      readTermsOfServiceFile: vi.fn(async () => ({
        name: "terms-of-service",
        timestamp: 1,
        data: {
          title: "Terms",
          bodyMarkdown: "Body",
        },
      })),
      saveTermsOfServiceEditorValue: vi.fn(),
    }));

    const { actions } = await import("../../src/routes/terms-of-service/edit/+page.server");
    const formData = new FormData();
    formData.set("title", " ");
    formData.set("bodyMarkdown", " ");

    const result = await actions.save({
      request: { formData: async () => formData },
    } as never);

    expect(result).toMatchObject({
      status: 400,
      data: {
        action: "save",
        message: "Please provide a title and body before saving.",
      },
    });
  });
});

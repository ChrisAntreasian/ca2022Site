import { beforeEach, describe, expect, it, vi } from "vitest";

describe("terms-of-service page server load", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads terms content and editor flag", async () => {
    vi.doMock("$lib/editing/core/auth.server", () => ({
      isEditorEnabled: vi.fn(() => true),
    }));

    vi.doMock("$lib/editing/resources/terms-of-service/terms-of-service.server", () => ({
      readTermsOfServiceFile: vi.fn(async () => ({
        name: "terms-of-service",
        timestamp: 1,
        data: {
          title: "Terms",
          bodyMarkdown: "Body",
        },
      })),
    }));

    const { load } = await import("../../src/routes/terms-of-service/+page.server");
    const result = await load({} as never);

    expect(result.editorEnabled).toBe(true);
    expect(result.terms.title).toBe("Terms");
    expect(result.terms.bodyMarkdown).toBe("Body");
  });
});

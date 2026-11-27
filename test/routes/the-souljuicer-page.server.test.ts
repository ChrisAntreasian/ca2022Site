import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "./fakeCookies";
import { loadResult } from "./loadResult";

/**
 * The page now reads through the content store rather than importing `#data/the-souljuicer.json`, so the
 * payload is injected by mocking the resource module's public read. Mocking at that seam — instead of at
 * the JSON file — mirrors how the page actually obtains data, and keeps this test independent of whether
 * live content currently lives on disk or in S3.
 */
const mockSouljuicerPayload = (payload: unknown) => {
  vi.doMock("#lib/editing/resources/souljuicer/souljuicer.server", () => ({
    readPublicSouljuicerFile: async () => payload,
  }));
};

describe("SoulJuicer page server load", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fills in missing display fields from stored entries", async () => {
    mockSouljuicerPayload({
      name: "the-souljuicer",
      timestamp: 1,
      data: {
        data: [
          {
            id: 8,
            attributes: {
              createdAt: "2024-03-01T00:00:00.000Z",
              updatedAt: "2024-03-01T00:00:00.000Z",
              publishedAt: "2024-03-01T00:00:00.000Z",
              order: 12,
              description: "A test entry",
              image: { data: null },
            },
          },
        ],
        meta: {
          pagination: {
            page: 1,
            pageSize: 25,
            pageCount: 1,
            total: 1,
          },
        },
      },
    });

    const { load } =
      await import("../../src/routes/the-souljuicer/[...aid]/+page.server");
    const result = loadResult(
      await load({ cookies: fakeCookies(), params: {} } as never),
    );

    expect(result.categoryTitle).toBe("the SoulJuicer");
    expect(result.artPieces).toHaveLength(1);
    expect(result.artPiece.id).toBe(8);
    expect(result.artPiece.attributes.title).toBe("the SoulJuicer");
    expect(result.artPiece.attributes.createdDate).toBe(
      "2024-03-01T00:00:00.000Z",
    );
    expect(result.artPiece.attributes.medium).toBe("pencil");
  });
});

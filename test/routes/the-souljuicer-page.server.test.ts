import { beforeEach, describe, expect, it, vi } from "vitest";

describe("SoulJuicer page server load", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fills in missing display fields from stored entries", async () => {
    vi.doMock("$data/the-souljuicer.json", () => ({
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
    }));

    const { load } = await import("../../src/routes/the-souljuicer/[...aid]/+page.server");
    const result = await load({ params: {} } as never);

    expect(result.categoryTitle).toBe("the SoulJuicer");
    expect(result.artPieces).toHaveLength(1);
    expect(result.artPiece.id).toBe(8);
    expect(result.artPiece.attributes.title).toBe("the SoulJuicer");
    expect(result.artPiece.attributes.createdDate).toBe("2024-03-01T00:00:00.000Z");
    expect(result.artPiece.attributes.medium).toBe("pencil");
  });
});

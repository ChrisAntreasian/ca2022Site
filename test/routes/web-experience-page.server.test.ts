import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Web Experience page server load", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not crash when an entry is missing logo or image data", async () => {
    vi.doMock("$data/web-experience.json", () => ({
      data: {
        data: [
          {
            attributes: {
              page_details: {
                data: [
                  {
                    id: 3,
                    attributes: {
                      title: "Web Development",
                      description: "Intro copy",
                    },
                  },
                ],
              },
              rich_links: {
                data: [
                  {
                    id: 2,
                    attributes: {
                      position: 1,
                      title: "No Media Entry",
                      body: "Body",
                      logo: { data: null },
                      link: "https://example.com",
                      secondLink: null,
                      image: { data: null },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    }));

    const { load } = await import("../../src/routes/web-experience/[...eid]/+page.server");
    const result = await load({ params: {} } as never);

    expect(result.items).toHaveLength(2);
    expect(result.item.id).toBe(-1);
    expect(result.items[1].title).toBe("No Media Entry");
    expect(result.items[1].logo).toBeUndefined();
    expect(result.items[1].images).toEqual([]);
  });
});

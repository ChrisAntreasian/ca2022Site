import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeCookies } from "./fakeCookies";
import { loadResult } from "./loadResult";

// Simple mock event object. The loader now reads the editor session cookie to decide whether to offer an
// "Edit home" link, so the event must carry a cookies bag; `editorEnabled` itself is asserted in
// `home-page-edit-link.test.ts`, which drives the real gate instead of this stubbed one.
const mockLoadEvent = { cookies: fakeCookies() };

/**
 * The landing loader now reads through `readPublicFile("landing")` in `#lib/content.server` rather than a
 * static `#data/landing.json` import - that is the seam that lets home-page content come from S3. These
 * tests stub that seam so each one supplies its own payload without touching the filesystem or S3.
 */
let landingFile: unknown;

vi.doMock("#lib/content.server", () => ({
  readPublicFile: async () => landingFile,
}));

/** Build a landing envelope matching what readPublicFile returns: { data: { data: [entry] } }. */
const landingWith = (pageDetails: { id: number; attributes: unknown }[]) => ({
  name: "landing",
  timestamp: 1,
  data: {
    data: [{ id: 1, attributes: { page_details: { data: pageDetails } } }],
  },
});

describe("Main Page Server Logic", () => {
  beforeEach(() => {
    vi.resetModules(); // Clear module cache between tests
  });

  describe("Landing Page Load Function", () => {
    it("should process landing data correctly", async () => {
      landingFile = landingWith([
        { id: 5, attributes: { title: "Intro Section" } },
        { id: 6, attributes: { title: "Links Section" } },
      ]);

      // Import the load function after mocking
      const { load } = await import("../../src/routes/+page.server.ts");

      const result = loadResult(await load(mockLoadEvent as never));

      expect(result).toHaveProperty("intro");
      expect(result).toHaveProperty("links");
      expect(Array.isArray(result.intro)).toBe(true);
      expect(Array.isArray(result.links)).toBe(true);
    });

    it("should categorize intro and links correctly", async () => {
      // Mock with known data structure
      landingFile = landingWith([
        { id: 5, attributes: { title: "Intro Item" } },
        { id: 10, attributes: { title: "Links Item" } },
      ]);

      const { load } = await import("../../src/routes/+page.server.ts");
      const result = loadResult(await load(mockLoadEvent as never));

      // Intro should contain items with id 5
      expect(result.intro.some((item: { id: number }) => item.id === 5)).toBe(
        true,
      );
      // Links should contain items that are not id 5
      expect(result.links.some((item: { id: number }) => item.id === 10)).toBe(
        true,
      );
    });

    it("should handle empty data gracefully", async () => {
      landingFile = landingWith([]);

      const { load } = await import("../../src/routes/+page.server.ts");
      const result = loadResult(await load(mockLoadEvent as never));

      expect(result.intro).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });
  });

  describe("Data Structure Validation", () => {
    it("should return the expected structure", async () => {
      landingFile = landingWith([{ id: 5, attributes: { title: "Test" } }]);

      const { load } = await import("../../src/routes/+page.server.ts");
      const result = loadResult(await load(mockLoadEvent as never));

      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("intro");
      expect(result).toHaveProperty("links");
    });

    it("should handle multiple intro items", async () => {
      landingFile = landingWith([
        { id: 5, attributes: { title: "Intro 1" } },
        { id: 5, attributes: { title: "Intro 2" } },
        { id: 7, attributes: { title: "Link 1" } },
      ]);

      const { load } = await import("../../src/routes/+page.server.ts");
      const result = loadResult(await load(mockLoadEvent as never));

      expect(result.intro).toHaveLength(2);
      expect(result.links).toHaveLength(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

/**
 * These tests mock `$app/navigation` themselves instead of relying on `test/setup.ts`, and they re-import
 * `src/lib/history` per test - see the `beforeEach` in the `clientNavigate` block for why both matter.
 *
 * With `isolate: false` Vitest keeps one mock registry per worker, and `registerMocks` applies its queue in
 * order so a later file's registration replaces an earlier one for the same module id (`mockPath` overwrites
 * and invalidates). `src/lib/history.ts` binds `goto` at module scope, so that binding belongs to whichever
 * registration was live when the module was first evaluated - setup.ts's six-function factory, or another
 * file's - not necessarily the one this file registered. A static `import { goto }` here then tracked a mock
 * nothing called, and all 9 `clientNavigate` tests failed with `Number of calls: 0` while the pure
 * `cleanUrlSlug` tests kept passing. Re-importing after `resetModules()` pins both halves to one factory.
 */
vi.mock("$app/navigation", () => ({
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  preloadData: vi.fn(),
  preloadCode: vi.fn(),
}));

import { cleanUrlSlug } from "../../src/lib/history";

describe("History Utilities", () => {
  describe("cleanUrlSlug", () => {
    it("converts spaces to hyphens and lowercases", () => {
      expect(cleanUrlSlug("Hello World")).toBe("hello-world");
    });

    it("removes special characters", () => {
      expect(cleanUrlSlug("Hello! @#$% World?")).toBe("hello-world");
    });

    it("handles multiple consecutive spaces/special chars", () => {
      expect(cleanUrlSlug("Hello    !!!   World???")).toBe("hello-world");
    });

    it("removes leading hyphens", () => {
      expect(cleanUrlSlug("---Hello World")).toBe("hello-world");
    });

    it("removes trailing hyphens", () => {
      expect(cleanUrlSlug("Hello World---")).toBe("hello-world");
    });

    it("removes both leading and trailing hyphens", () => {
      expect(cleanUrlSlug("---Hello World---")).toBe("hello-world");
    });

    it("handles strings with only special characters", () => {
      expect(cleanUrlSlug("!@#$%^&*()")).toBe("");
    });

    it("preserves numbers and letters", () => {
      expect(cleanUrlSlug("Article 123 Test")).toBe("article-123-test");
    });

    it("handles already clean slugs", () => {
      expect(cleanUrlSlug("hello-world")).toBe("hello-world");
    });

    it("handles empty strings", () => {
      expect(cleanUrlSlug("")).toBe("");
    });

    it("handles single characters", () => {
      expect(cleanUrlSlug("a")).toBe("a");
      expect(cleanUrlSlug("!")).toBe("");
    });

    it("handles complex mixed cases", () => {
      expect(
        cleanUrlSlug("The Quick Brown Fox!!! Jumps Over??? The Lazy Dog."),
      ).toBe("the-quick-brown-fox-jumps-over-the-lazy-dog");
    });

    it("handles multiple hyphens in middle", () => {
      expect(cleanUrlSlug("hello----world")).toBe("hello-world");
    });

    it("handles unicode characters", () => {
      expect(cleanUrlSlug("café résumé")).toBe("caf-r-sum");
    });
  });

  describe("clientNavigate", () => {
    /**
     * `goto` and `clientNavigate` are re-read per test rather than used from the file-level imports.
     *
     * `src/lib/history.ts` binds `goto` at module scope, so under a shared worker its binding belongs to
     * whichever `$app/navigation` registration was live when that module was first evaluated - which can be
     * setup.ts's, or another file's, and not the factory this file registered. Re-importing both here means
     * `resetModules()` re-evaluates `history.ts` against the mock this file owns, so the function it calls and
     * the function asserted on below are necessarily the same object. Without this, 9 tests failed with
     * `Number of calls: 0` because a different mock had been called instead.
     */
    let clientNavigate: (
      scroll: boolean,
    ) => (url: string, slug?: string) => void;
    /** Typed as the mock Vitest produces, since these tests register `goto: vi.fn()` above. */
    let goto: Mock;

    beforeEach(async () => {
      vi.resetModules();

      const history = await import("../../src/lib/history");
      clientNavigate = history.clientNavigate;
      goto = (await import("$app/navigation")).goto as Mock;

      // Mock window.scrollTo
      Object.defineProperty(window, "scrollTo", {
        value: vi.fn(),
        writable: true,
      });
      vi.mocked(window.scrollTo).mockClear();
    });

    it("navigates to URL without slug when scroll is false", () => {
      const navigate = clientNavigate(false);
      navigate("/test-path");

      expect(goto).toHaveBeenCalledWith("/test-path", {});
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it("navigates to URL without slug when scroll is true", () => {
      const navigate = clientNavigate(true);
      navigate("/test-path");

      expect(goto).toHaveBeenCalledWith("/test-path", {});
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it("navigates to URL with cleaned slug when scroll is false", () => {
      const navigate = clientNavigate(false);
      navigate("/test-path", "Hello World!");

      expect(goto).toHaveBeenCalledWith("/test-path/hello-world", {});
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it("navigates to URL with cleaned slug when scroll is true", () => {
      const navigate = clientNavigate(true);
      navigate("/test-path", "Hello World!");

      expect(goto).toHaveBeenCalledWith("/test-path/hello-world", {});
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it("handles empty slug", () => {
      const navigate = clientNavigate(false);
      navigate("/test-path", "");

      expect(goto).toHaveBeenCalledWith("/test-path/", {});
    });

    it("handles complex slugs", () => {
      const navigate = clientNavigate(false);
      navigate("/articles", "The Quick Brown Fox!!! Jumps Over the Lazy Dog.");

      expect(goto).toHaveBeenCalledWith(
        "/articles/the-quick-brown-fox-jumps-over-the-lazy-dog",
        {},
      );
    });

    it("handles root path navigation", () => {
      const navigate = clientNavigate(true);
      navigate("/", "test-slug");

      expect(goto).toHaveBeenCalledWith("/test-slug", {});
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it("preserves URL structure with multiple path segments", () => {
      const navigate = clientNavigate(false);
      navigate("/category/subcategory", "article title");

      expect(goto).toHaveBeenCalledWith(
        "/category/subcategory/article-title",
        {},
      );
    });

    it("handles special characters in URL path", () => {
      const navigate = clientNavigate(false);
      navigate("/path-with-hyphens", "slug with spaces");

      expect(goto).toHaveBeenCalledWith(
        "/path-with-hyphens/slug-with-spaces",
        {},
      );
    });

    it("creates different navigation functions based on scroll parameter", () => {
      const scrollNavigate = clientNavigate(true);
      const noScrollNavigate = clientNavigate(false);

      scrollNavigate("/path1");
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });

      vi.mocked(goto).mockClear();
      vi.mocked(window.scrollTo).mockClear();

      noScrollNavigate("/path2");
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });
});

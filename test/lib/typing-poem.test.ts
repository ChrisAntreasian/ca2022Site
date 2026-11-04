import { describe, it, expect } from "vitest";
import { Result, Schema } from "effect";
import { poemC, strapiPoemC, type StrapiPoem } from "../../src/lib/typing/poem";

describe("Poem Type Validation", () => {
  describe("poemC codec", () => {
    it("validates complete poem structure", () => {
      const validPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "The Ocean's Song",
        body: "Waves crash against the shore,\nWhispering secrets of the deep,\nEternal dance of foam and stone.",
        featured: true,
        position: 1,
      };

      const result = Schema.decodeUnknownResult(poemC)(validPoem);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.title).toBe("The Ocean's Song");
        expect(result.success.featured).toBe(true);
        expect(result.success.position).toBe(1);
        expect(result.success.body).toContain("Waves crash");
      }
    });

    it("validates poem with multiline body", () => {
      const poemWithMultilineBody = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Haiku",
        body: "Cherry blossoms fall\nPetals drift on gentle breeze\nSpring's fleeting beauty",
        featured: false,
        position: 5,
      };

      const result = Schema.decodeUnknownResult(poemC)(poemWithMultilineBody);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.body).toContain("\n");
        expect(result.success.body.split("\n")).toHaveLength(3);
      }
    });

    it("validates poem with long text content", () => {
      const longBody =
        "This is a very long poem that contains many lines and verses. ".repeat(
          50,
        );

      const poemWithLongContent = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Epic Poem",
        body: longBody,
        featured: true,
        position: 10,
      };

      const result = Schema.decodeUnknownResult(poemC)(poemWithLongContent);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.body.length).toBeGreaterThan(1000);
        expect(result.success.title).toBe("Epic Poem");
      }
    });

    it("validates non-featured poem", () => {
      const nonFeaturedPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Hidden Gem",
        body: "A quiet poem waiting to be discovered.",
        featured: false,
        position: 100,
      };

      const result = Schema.decodeUnknownResult(poemC)(nonFeaturedPoem);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.featured).toBe(false);
        expect(result.success.position).toBe(100);
      }
    });

    it("rejects invalid title type", () => {
      const invalidPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: 123, // should be string
        body: "Valid body content",
        featured: true,
        position: 1,
      };

      const result = Schema.decodeUnknownResult(poemC)(invalidPoem);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects invalid body type", () => {
      const invalidPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Valid Title",
        body: null, // should be string
        featured: true,
        position: 1,
      };

      const result = Schema.decodeUnknownResult(poemC)(invalidPoem);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects invalid featured type", () => {
      const invalidPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Valid Title",
        body: "Valid body",
        featured: "yes", // should be boolean
        position: 1,
      };

      const result = Schema.decodeUnknownResult(poemC)(invalidPoem);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects invalid position type", () => {
      const invalidPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Valid Title",
        body: "Valid body",
        featured: true,
        position: "1", // should be number
      };

      const result = Schema.decodeUnknownResult(poemC)(invalidPoem);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects missing required fields", () => {
      const incompletePoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "Valid Title",
        body: "Valid body",
        // missing featured and position
      };

      const result = Schema.decodeUnknownResult(poemC)(incompletePoem);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects missing base fields", () => {
      const incompletePoemBase = {
        title: "Valid Title",
        body: "Valid body",
        featured: true,
        position: 1,
        // missing createdAt, updatedAt, publishedAt
      };

      const result = Schema.decodeUnknownResult(poemC)(incompletePoemBase);
      expect(Result.isFailure(result)).toBe(true);
    });
  });

  describe("strapiPoemC codec", () => {
    it("validates complete Strapi poem response", () => {
      const validStrapiPoem = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              publishedAt: "2023-12-01T16:00:00.000Z",
              title: "Morning Dew",
              body: "Dewdrops glisten in the dawn,\nNature's diamonds on the lawn.",
              featured: true,
              position: 1,
            },
          },
          {
            id: 2,
            attributes: {
              createdAt: "2023-12-01T11:00:00.000Z",
              updatedAt: "2023-12-01T16:00:00.000Z",
              publishedAt: "2023-12-01T17:00:00.000Z",
              title: "Sunset Dreams",
              body: "Orange skies fade to night,\nStars begin their ancient light.",
              featured: false,
              position: 2,
            },
          },
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 2,
          },
        },
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(validStrapiPoem);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const typed: StrapiPoem = result.success;
        expect(typed.data).toHaveLength(2);
        expect(typed.meta.pagination.total).toBe(2);

        if (typed.data && typed.data[0]) {
          expect(typed.data[0].id).toBe(1);
          expect(typed.data[0].attributes.title).toBe("Morning Dew");
          expect(typed.data[0].attributes.featured).toBe(true);
        }

        if (typed.data && typed.data[1]) {
          expect(typed.data[1].id).toBe(2);
          expect(typed.data[1].attributes.title).toBe("Sunset Dreams");
          expect(typed.data[1].attributes.featured).toBe(false);
        }
      }
    });

    it("validates empty poem array", () => {
      const emptyPoems = {
        data: [],
        meta: {
          pagination: {
            page: 1,
            pageCount: 0,
            pageSize: 25,
            total: 0,
          },
        },
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(emptyPoems);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.data).toHaveLength(0);
        expect(result.success.meta.pagination.total).toBe(0);
      }
    });

    it("validates null poem data", () => {
      const nullPoems = {
        data: null,
        meta: {
          pagination: {
            page: 1,
            pageCount: 0,
            pageSize: 25,
            total: 0,
          },
        },
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(nullPoems);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.data).toBeNull();
      }
    });

    it("validates single poem in array", () => {
      const singlePoem = {
        data: [
          {
            id: 42,
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              publishedAt: "2023-12-01T16:00:00.000Z",
              title: "Solitude",
              body: "In quiet moments, truth is found.",
              featured: true,
              position: 1,
            },
          },
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1,
          },
        },
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(singlePoem);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.data).toHaveLength(1);
        if (result.success.data && result.success.data[0]) {
          expect(result.success.data[0].id).toBe(42);
          expect(result.success.data[0].attributes.title).toBe("Solitude");
        }
      }
    });

    it("rejects invalid poem in array", () => {
      const invalidPoemArray = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              publishedAt: "2023-12-01T16:00:00.000Z",
              title: "Valid Poem",
              body: "Valid content",
              featured: true,
              position: 1,
            },
          },
          {
            id: "invalid-id", // should be number
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              publishedAt: "2023-12-01T16:00:00.000Z",
              title: "Invalid Poem",
              body: "Invalid content",
              featured: true,
              position: 2,
            },
          },
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 2,
          },
        },
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(invalidPoemArray);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects missing meta field", () => {
      const noMeta = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              publishedAt: "2023-12-01T16:00:00.000Z",
              title: "Valid Poem",
              body: "Valid content",
              featured: true,
              position: 1,
            },
          },
        ],
        // missing meta
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(noMeta);
      expect(Result.isFailure(result)).toBe(true);
    });

    it("rejects invalid pagination structure", () => {
      const invalidPagination = {
        data: [],
        meta: {
          pagination: {
            page: "1", // should be number
            pageCount: 0,
            pageSize: 25,
            total: 0,
          },
        },
      };

      const result = Schema.decodeUnknownResult(strapiPoemC)(invalidPagination);
      expect(Result.isFailure(result)).toBe(true);
    });
  });

  describe("Type aliases and integration", () => {
    it("uses StrapiPoem type correctly", () => {
      const strapiPoem: StrapiPoem = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: "2023-12-01T10:00:00.000Z",
              updatedAt: "2023-12-01T15:30:00.000Z",
              publishedAt: "2023-12-01T16:00:00.000Z",
              title: "Type Test",
              body: "Testing the type system",
              featured: true,
              position: 1,
            },
          },
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1,
          },
        },
      };

      // This should compile without issues
      expect(strapiPoem.data).toHaveLength(1);
      expect(strapiPoem.meta.pagination.total).toBe(1);

      if (strapiPoem.data && strapiPoem.data[0]) {
        expect(strapiPoem.data[0].attributes.title).toBe("Type Test");
      }
    });

    it("handles edge cases in poem content", () => {
      const edgeCasePoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: 'Special Characters: "Quotes" & Symbols @#$%',
        body: "Line 1\n\nLine 3 with empty line above\n\tTabbed line\n\"Quoted text\"\n'Single quotes'",
        featured: false,
        position: 0,
      };

      const result = Schema.decodeUnknownResult(poemC)(edgeCasePoem);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.title).toContain("Special Characters");
        expect(result.success.body).toContain("\n\n");
        expect(result.success.body).toContain("\t");
        expect(result.success.position).toBe(0);
      }
    });

    it("validates large position numbers", () => {
      const highPositionPoem = {
        createdAt: "2023-12-01T10:00:00.000Z",
        updatedAt: "2023-12-01T15:30:00.000Z",
        publishedAt: "2023-12-01T16:00:00.000Z",
        title: "High Position",
        body: "This poem has a very high position number",
        featured: false,
        position: 999999,
      };

      const result = Schema.decodeUnknownResult(poemC)(highPositionPoem);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success.position).toBe(999999);
      }
    });
  });
});

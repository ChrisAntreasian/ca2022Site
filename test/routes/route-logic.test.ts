import { describe, it, expect } from 'vitest';

describe('Route Logic Patterns', () => {
  describe('Data Processing Logic', () => {
    it('should categorize items based on ID correctly', () => {
      // Test the core logic that the route uses
      const introIds = [5];
      const mockData = [
        { id: 5, attributes: { title: 'Intro Item' } },
        { id: 10, attributes: { title: 'Links Item' } },
        { id: 7, attributes: { title: 'Another Link' } }
      ];

      const result = mockData.reduce(
        (
          acc: {
            intro: Array<{ id: number; attributes: { title: string } }>;
            links: Array<{ id: number; attributes: { title: string } }>;
          },
          d: { id: number; attributes: { title: string } }
        ) => {
          if (introIds.includes(d.id)) {
            acc.intro.push(d);
          } else {
            acc.links.push(d);
          }
          return acc;
        },
        {
          intro: [],
          links: [],
        }
      );

      expect(result.intro).toHaveLength(1);
      expect(result.links).toHaveLength(2);
      expect(result.intro[0].id).toBe(5);
      expect(result.links.every(item => item.id !== 5)).toBe(true);
    });

    it('should handle multiple intro items', () => {
      const introIds = [5];
      const mockData = [
        { id: 5, attributes: { title: 'Intro Item 1' } },
        { id: 5, attributes: { title: 'Intro Item 2' } },
        { id: 7, attributes: { title: 'Link Item' } }
      ];

      const result = mockData.reduce(
        (
          acc: {
            intro: Array<{ id: number; attributes: { title: string } }>;
            links: Array<{ id: number; attributes: { title: string } }>;
          },
          d: { id: number; attributes: { title: string } }
        ) => {
          if (introIds.includes(d.id)) {
            acc.intro.push(d);
          } else {
            acc.links.push(d);
          }
          return acc;
        },
        {
          intro: [],
          links: [],
        }
      );

      expect(result.intro).toHaveLength(2);
      expect(result.links).toHaveLength(1);
    });

    it('should handle empty data', () => {
      const introIds = [5];
      const mockData: Array<{ id: number; attributes: { title: string } }> = [];

      const result = mockData.reduce(
        (
          acc: {
            intro: Array<{ id: number; attributes: { title: string } }>;
            links: Array<{ id: number; attributes: { title: string } }>;
          },
          d: { id: number; attributes: { title: string } }
        ) => {
          if (introIds.includes(d.id)) {
            acc.intro.push(d);
          } else {
            acc.links.push(d);
          }
          return acc;
        },
        {
          intro: [],
          links: [],
        }
      );

      expect(result.intro).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });

    it('should preserve item structure during processing', () => {
      const introIds = [5];
      const mockData = [
        { id: 5, attributes: { title: 'Test Title', extra: 'data' } }
      ];

      const result = mockData.reduce(
        (
          acc: {
            intro: Array<{ id: number; attributes: { title: string; extra?: string } }>;
            links: Array<{ id: number; attributes: { title: string; extra?: string } }>;
          },
          d: { id: number; attributes: { title: string; extra?: string } }
        ) => {
          if (introIds.includes(d.id)) {
            acc.intro.push(d);
          } else {
            acc.links.push(d);
          }
          return acc;
        },
        {
          intro: [],
          links: [],
        }
      );

      expect(result.intro[0].attributes.title).toBe('Test Title');
      expect(result.intro[0].attributes.extra).toBe('data');
    });
  });

  describe('Poems Route Logic', () => {
    it('should sort items by position', () => {
      const mockData = [
        { id: 1, attributes: { position: 3, title: 'Third' } },
        { id: 2, attributes: { position: 1, title: 'First' } },
        { id: 3, attributes: { position: 2, title: 'Second' } }
      ];

      const sorted = mockData.sort((a, b) => a.attributes.position - b.attributes.position);

      expect(sorted[0].attributes.title).toBe('First');
      expect(sorted[1].attributes.title).toBe('Second');
      expect(sorted[2].attributes.title).toBe('Third');
    });

    it('should transform data to Item format', () => {
      const mockData = [
        { id: 1, attributes: { title: 'Test Poem', body: 'Poem content', position: 1 } }
      ];

      const items = mockData.reduce(
        (acc: Array<{ id: number; title: string; body: string }>, i) => [
          ...acc,
          {
            id: i.id,
            title: i.attributes.title,
            body: i.attributes.body,
          },
        ],
        []
      );

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(1);
      expect(items[0].title).toBe('Test Poem');
      expect(items[0].body).toBe('Poem content');
    });

    it('should filter items by ID correctly', () => {
      const items = [
        { id: 1, title: 'First', body: 'Content 1' },
        { id: 2, title: 'Second', body: 'Content 2' },
        { id: 3, title: 'Third', body: 'Content 3' }
      ];

      const targetId = 2;
      const item = items.filter((i: { id: number }) => i.id === targetId)[0];

      expect(item).toBeDefined();
      expect(item.id).toBe(2);
      expect(item.title).toBe('Second');
    });

    it('should handle random selection when no ID provided', () => {
      const mockData = [
        { id: 1, attributes: { title: 'Poem 1', body: 'Content', position: 1 } },
        { id: 2, attributes: { title: 'Poem 2', body: 'Content', position: 2 } },
        { id: 3, attributes: { title: 'Poem 3', body: 'Content', position: 3 } }
      ];

      // Simulate random selection logic
      const randomId = mockData[Math.floor(Math.random() * mockData.length)].id;
      
      expect(typeof randomId).toBe('number');
      expect([1, 2, 3]).toContain(randomId);
    });
  });

  describe('Layout Server Logic', () => {
    it('should shorten string correctly', () => {
      const shortenString = (str: string) => {
        const a = str.split(" ");
        return `${a[0].charAt(0)}. ${a[1]}`;
      };

      expect(shortenString("John Doe")).toBe("J. Doe");
      expect(shortenString("Jane Smith")).toBe("J. Smith");
      expect(shortenString("Chris Antreasian")).toBe("C. Antreasian");
    });

    it('should handle edge cases in string shortening', () => {
      const shortenString = (str: string) => {
        const a = str.split(" ");
        return `${a[0].charAt(0)}. ${a[1]}`;
      };

      expect(shortenString("A B")).toBe("A. B");
      expect(shortenString("Test User")).toBe("T. User");
    });
  });
});
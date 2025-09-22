import { describe, it, expect, vi } from 'vitest';

// Simple mock event object
const mockLoadEvent = {};

describe('Main Page Server Logic', () => {
  describe('Landing Page Load Function', () => {
    it('should process landing data correctly', async () => {
      // Mock the landing data import
      vi.doMock('$data/landing.json', () => ({
        data: {
          data: [{
            attributes: {
              page_details: {
                data: [
                  { id: 5, attributes: { title: 'Intro Section' } },
                  { id: 6, attributes: { title: 'Links Section' } }
                ]
              }
            }
          }]
        }
      }));

      // Import the load function after mocking
      const { load } = await import('../../src/routes/+page.server.ts');
      
      const result = await load(mockLoadEvent as never);
      
      expect(result).toHaveProperty('intro');
      expect(result).toHaveProperty('links');
      expect(Array.isArray(result.intro)).toBe(true);
      expect(Array.isArray(result.links)).toBe(true);
    });

    it('should categorize intro and links correctly', async () => {
      // Mock with known data structure
      vi.doMock('$data/landing.json', () => ({
        data: {
          data: [{
            attributes: {
              page_details: {
                data: [
                  { id: 5, attributes: { title: 'Intro Item' } },
                  { id: 10, attributes: { title: 'Links Item' } }
                ]
              }
            }
          }]
        }
      }));

      const { load } = await import('../../src/routes/+page.server.ts');
      const result = await load(mockLoadEvent as never);
      
      // Intro should contain items with id 5
      expect(result.intro.some((item: { id: number }) => item.id === 5)).toBe(true);
      // Links should contain items that are not id 5
      expect(result.links.some((item: { id: number }) => item.id === 10)).toBe(true);
    });

    it('should handle empty data gracefully', async () => {
      vi.doMock('$data/landing.json', () => ({
        data: {
          data: [{
            attributes: {
              page_details: {
                data: []
              }
            }
          }]
        }
      }));

      const { load } = await import('../../src/routes/+page.server.ts');
      const result = await load(mockLoadEvent as never);
      
      expect(result.intro).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });
  });

  describe('Data Structure Validation', () => {
    it('should return the expected structure', async () => {
      vi.doMock('$data/landing.json', () => ({
        data: {
          data: [{
            attributes: {
              page_details: {
                data: [
                  { id: 5, attributes: { title: 'Test' } }
                ]
              }
            }
          }]
        }
      }));

      const { load } = await import('../../src/routes/+page.server.ts');
      const result = await load(mockLoadEvent as never);
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('intro');
      expect(result).toHaveProperty('links');
    });

    it('should handle multiple intro items', async () => {
      vi.doMock('$data/landing.json', () => ({
        data: {
          data: [{
            attributes: {
              page_details: {
                data: [
                  { id: 5, attributes: { title: 'Intro 1' } },
                  { id: 5, attributes: { title: 'Intro 2' } },
                  { id: 7, attributes: { title: 'Link 1' } }
                ]
              }
            }
          }]
        }
      }));

      const { load } = await import('../../src/routes/+page.server.ts');
      const result = await load(mockLoadEvent as never);
      
      expect(result.intro).toHaveLength(2);
      expect(result.links).toHaveLength(1);
    });
  });
});
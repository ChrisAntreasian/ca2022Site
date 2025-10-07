import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Body Utilities', () => {
  describe('noScroll action', () => {
    let mockElement: {
      classList: {
        toggle: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      // Create a mock DOM element
      mockElement = {
        classList: {
          toggle: vi.fn(),
          remove: vi.fn(),
        },
      };
      
      vi.clearAllMocks();
    });

    it('adds no-scroll class when toggled true', async () => {
      const { noScroll } = await import('../../src/lib/body');
      
      noScroll(mockElement as unknown as HTMLElement, true);

      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', true);
    });

    it('removes no-scroll class when toggled false', async () => {
      const { noScroll } = await import('../../src/lib/body');
      
      noScroll(mockElement as unknown as HTMLElement, false);

      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', false);
    });

    it('returns update function that can toggle class', async () => {
      const { noScroll } = await import('../../src/lib/body');
      
      const action = noScroll(mockElement as unknown as HTMLElement, true);

      expect(action.update).toBeDefined();
      expect(typeof action.update).toBe('function');

      // Test update function
      action.update(false);
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', false);
    });

    it('returns destroy function that removes class', async () => {
      const { noScroll } = await import('../../src/lib/body');
      
      const action = noScroll(mockElement as unknown as HTMLElement, true);

      expect(action.destroy).toBeDefined();
      expect(typeof action.destroy).toBe('function');

      // Test destroy function
      action.destroy();
      expect(mockElement.classList.remove).toHaveBeenCalledWith('no-scroll');
    });

    it('handles multiple toggle operations correctly', async () => {
      const { noScroll } = await import('../../src/lib/body');
      
      const action = noScroll(mockElement as unknown as HTMLElement, true);

      // Initial toggle
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', true);

      // Update to false
      action.update(false);
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', false);

      // Update back to true
      action.update(true);
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', true);

      // Destroy should always remove
      action.destroy();
      expect(mockElement.classList.remove).toHaveBeenCalledWith('no-scroll');
    });
  });
});

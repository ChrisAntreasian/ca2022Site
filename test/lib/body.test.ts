import { describe, it, expect, beforeEach, vi } from 'vitest';
import { noScroll } from '../../src/lib/body';

describe('Body Utilities', () => {
  describe('noScroll action', () => {
    let mockElement: HTMLElement;

    beforeEach(() => {
      // Create a mock DOM element
      mockElement = {
        classList: {
          toggle: vi.fn(),
          remove: vi.fn(),
        },
      } as unknown as HTMLElement;
    });

    it('adds no-scroll class when toggled true', () => {
      noScroll(mockElement, true);

      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', true);
    });

    it('removes no-scroll class when toggled false', () => {
      noScroll(mockElement, false);

      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', false);
    });

    it('returns update function that can toggle class', () => {
      const action = noScroll(mockElement, true);

      expect(action.update).toBeDefined();
      expect(typeof action.update).toBe('function');

      // Test update function
      action.update(false);
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', false);
    });

    it('returns destroy function that removes class', () => {
      const action = noScroll(mockElement, true);

      expect(action.destroy).toBeDefined();
      expect(typeof action.destroy).toBe('function');

      // Test destroy function
      action.destroy();
      expect(mockElement.classList.remove).toHaveBeenCalledWith('no-scroll');
    });

    it('handles multiple toggle operations correctly', () => {
      const action = noScroll(mockElement, true);

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

    it('works with different initial states', () => {
      // Test starting with false
      noScroll(mockElement, false);
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', false);

      // Reset mock
      vi.clearAllMocks();

      // Test starting with true
      noScroll(mockElement, true);
      expect(mockElement.classList.toggle).toHaveBeenCalledWith('no-scroll', true);
    });

    it('destroy function works independently of current state', () => {
      const action = noScroll(mockElement, true);
      
      // Update to false
      action.update(false);
      
      // Destroy should still remove the class regardless of current toggle state
      action.destroy();
      expect(mockElement.classList.remove).toHaveBeenCalledWith('no-scroll');
    });
  });
});

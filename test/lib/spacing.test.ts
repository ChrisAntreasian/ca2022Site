import { describe, it, expect } from 'vitest';
import { rem, wrapperWidth, mqBreakPoint, fromRem, toRem, contextHeightKey } from '../../src/lib/spacing';

describe('Spacing Utilities', () => {
  describe('constants', () => {
    it('has correct rem value', () => {
      expect(rem).toBe(16);
    });

    it('has correct wrapper width', () => {
      expect(wrapperWidth).toBe(1200); // 75 * 16 = 1200px
    });

    it('has correct mobile breakpoint', () => {
      expect(mqBreakPoint).toBe(768);
    });

    it('has context key defined', () => {
      expect(typeof contextHeightKey).toBe('string');
      expect(contextHeightKey).toBeTruthy();
    });
  });

  describe('fromRem function', () => {
    it('converts rem to pixels correctly', () => {
      expect(fromRem(1)).toBe(16);
      expect(fromRem(2)).toBe(32);
      expect(fromRem(0.5)).toBe(8);
      expect(fromRem(0)).toBe(0);
    });

    it('handles negative values', () => {
      expect(fromRem(-1)).toBe(-16);
      expect(fromRem(-2.5)).toBe(-40);
    });

    it('handles decimal values', () => {
      expect(fromRem(1.5)).toBe(24);
      expect(fromRem(2.25)).toBe(36);
    });
  });

  describe('toRem function', () => {
    it('converts pixels to rem correctly', () => {
      expect(toRem(16)).toBe(1);
      expect(toRem(32)).toBe(2);
      expect(toRem(8)).toBe(0.5);
      expect(toRem(0)).toBe(0);
    });

    it('handles negative values', () => {
      expect(toRem(-16)).toBe(-1);
      expect(toRem(-40)).toBe(-2.5);
    });

    it('handles decimal pixel values', () => {
      expect(toRem(24)).toBe(1.5);
      expect(toRem(36)).toBe(2.25);
    });
  });

  describe('conversion consistency', () => {
    it('fromRem and toRem are inverse functions', () => {
      const testValues = [0, 1, 2.5, -1, 10.75];
      
      testValues.forEach(value => {
        expect(toRem(fromRem(value))).toBeCloseTo(value);
        expect(fromRem(toRem(value * 16))).toBeCloseTo(value * 16);
      });
    });
  });
});

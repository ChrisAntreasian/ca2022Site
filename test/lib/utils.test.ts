import { describe, it, expect } from 'vitest';
import { randomArrItem } from '../../src/lib/array';
import { daysFromNow } from '../../src/lib/date';

describe('Array Utilities', () => {
  describe('randomArrItem', () => {
    it('returns an item from the array', () => {
      const testArray = ['a', 'b', 'c', 'd'];
      const result = randomArrItem(testArray);
      
      expect(testArray).toContain(result);
    });

    it('handles single item array', () => {
      const testArray = ['single'];
      const result = randomArrItem(testArray);
      
      expect(result).toBe('single');
    });

    it('handles different data types', () => {
      const numbers = [1, 2, 3, 4, 5];
      const objects = [{ id: 1 }, { id: 2 }, { id: 3 }];
      
      const numberResult = randomArrItem(numbers);
      const objectResult = randomArrItem(objects);
      
      expect(numbers).toContain(numberResult);
      expect(objects).toContain(objectResult);
      expect(typeof numberResult).toBe('number');
      expect(typeof objectResult).toBe('object');
    });

    it('returns undefined for empty array', () => {
      const emptyArray: string[] = [];
      const result = randomArrItem(emptyArray);
      
      expect(result).toBeUndefined();
    });
  });
});

describe('Date Utilities', () => {
  describe('daysFromNow', () => {
    it('calculates future date correctly', () => {
      const result = daysFromNow(7);
      const now = new Date();
      const expected = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      expect(result.getDate()).toBe(expected.getDate());
      expect(result.getMonth()).toBe(expected.getMonth());
      expect(result.getFullYear()).toBe(expected.getFullYear());
    });

    it('calculates past date correctly', () => {
      const result = daysFromNow(-7);
      const now = new Date();
      const expected = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      expect(result.getDate()).toBe(expected.getDate());
      expect(result.getMonth()).toBe(expected.getMonth());
      expect(result.getFullYear()).toBe(expected.getFullYear());
    });

    it('handles zero days (same day)', () => {
      const result = daysFromNow(0);
      const now = new Date();
      
      expect(result.getDate()).toBe(now.getDate());
      expect(result.getMonth()).toBe(now.getMonth());
      expect(result.getFullYear()).toBe(now.getFullYear());
    });

    it('handles large day values', () => {
      const result = daysFromNow(365);
      const now = new Date();
      
      // Should be approximately one year in the future
      const yearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      // Allow for some variance due to leap years
      const timeDifference = Math.abs(result.getTime() - yearFromNow.getTime());
      const dayDifference = timeDifference / (24 * 60 * 60 * 1000);
      
      expect(dayDifference).toBeLessThan(2); // Within 2 days
    });

    it('returns a Date object', () => {
      const result = daysFromNow(1);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

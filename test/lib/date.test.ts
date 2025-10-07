import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { daysFromNow } from '../../src/lib/date';

describe('date utilities', () => {
  describe('daysFromNow', () => {
    
    beforeEach(() => {
      // Mock Date constructor to return a fixed timestamp for consistent testing
      const fixedTime = new Date('2024-01-01T12:00:00.000Z').getTime();
      vi.useFakeTimers();
      vi.setSystemTime(fixedTime);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return a date that is the specified number of days from now', () => {
      const result = daysFromNow(5);
      const expected = new Date('2024-01-06T12:00:00.000Z');
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle negative days (past dates)', () => {
      const result = daysFromNow(-3);
      const expected = new Date('2023-12-29T12:00:00.000Z');
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle zero days (same day)', () => {
      const result = daysFromNow(0);
      const expected = new Date('2024-01-01T12:00:00.000Z');
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle fractional days', () => {
      const result = daysFromNow(1.5);
      const expected = new Date('2024-01-02T24:00:00.000Z'); // 1.5 days = 36 hours
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle large numbers of days', () => {
      const result = daysFromNow(365);
      const expected = new Date('2024-12-31T12:00:00.000Z'); // 365 days from Jan 1 2024 is Dec 31 2024
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should return a valid Date object', () => {
      const result = daysFromNow(10);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
      expect(isNaN(result.getTime())).toBe(false);
    });

    it('should calculate correctly with current system time', () => {
      // Restore the original Date.now for this test
      vi.restoreAllMocks();
      
      const beforeTest = new Date();
      const result = daysFromNow(1);
      const afterTest = new Date();
      
      // The result should be approximately 24 hours from now
      const oneDayInMs = 24 * 60 * 60 * 1000;
      const expectedMin = beforeTest.getTime() + oneDayInMs;
      const expectedMax = afterTest.getTime() + oneDayInMs;
      
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should work with decimal precision', () => {
      const result = daysFromNow(0.001); // About 1.44 minutes
      const expected = new Date('2024-01-01T12:01:26.400Z');
      
      expect(result.getTime()).toBe(expected.getTime());
    });
  });
});

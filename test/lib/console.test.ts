import { describe, it, expect, vi } from 'vitest';
import { cLog } from '../../src/lib/console';

describe('Console Utilities', () => {
  describe('cLog', () => {
    it('logs string and value then returns the value', () => {
      const originalLog = console.log;
      const logMock = vi.fn();
      console.log = logMock;

      const testValue = { test: 'data' };
      const logMessage = 'Test message';

      const result = cLog(logMessage)(testValue);

      expect(logMock).toHaveBeenCalledWith(logMessage, testValue);
      expect(result).toBe(testValue);

      console.log = originalLog;
    });

    it('returns the exact same reference for objects', () => {
      const originalLog = console.log;
      console.log = vi.fn();

      const testObject = { complex: { nested: 'data' } };
      const result = cLog('test')(testObject);

      expect(result).toBe(testObject); // Same reference
      expect(result === testObject).toBe(true);

      console.log = originalLog;
    });

    it('works with different data types', () => {
      const originalLog = console.log;
      const logMock = vi.fn();
      console.log = logMock;

      // Test with string
      const stringResult = cLog('String test')('hello world');
      expect(stringResult).toBe('hello world');

      // Test with number
      const numberResult = cLog('Number test')(42);
      expect(numberResult).toBe(42);

      // Test with boolean
      const booleanResult = cLog('Boolean test')(true);
      expect(booleanResult).toBe(true);

      // Test with array
      const arrayValue = [1, 2, 3];
      const arrayResult = cLog('Array test')(arrayValue);
      expect(arrayResult).toBe(arrayValue);

      // Test with null
      const nullResult = cLog('Null test')(null);
      expect(nullResult).toBe(null);

      // Test with undefined
      const undefinedResult = cLog('Undefined test')(undefined);
      expect(undefinedResult).toBe(undefined);

      expect(logMock).toHaveBeenCalledTimes(6);

      console.log = originalLog;
    });

    it('can be chained in functional pipelines', () => {
      const originalLog = console.log;
      console.log = vi.fn();

      // Functional pipeline simulation
      const alternativePipeline = (value: number) => {
        const step1 = cLog('Step 1')(value * 2) as number;
        const step2 = cLog('Step 2')(step1 + 10) as number;
        return cLog('Final')(step2.toString()) as string;
      };

      const result = alternativePipeline(5);
      expect(result).toBe('20'); // (5 * 2) + 10 = 20

      console.log = originalLog;
    });

    it('handles empty string messages', () => {
      const originalLog = console.log;
      const logMock = vi.fn();
      console.log = logMock;

      const testValue = 'test data';
      const result = cLog('')(testValue);

      expect(logMock).toHaveBeenCalledWith('', testValue);
      expect(result).toBe(testValue);

      console.log = originalLog;
    });

    it('preserves function behavior when used as debugging tool', () => {
      const originalLog = console.log;
      console.log = vi.fn();

      // Simulate using cLog in a functional chain
      const processData = (data: string) => data.toUpperCase();
      const withLogging = (data: string) => cLog('Processing')(processData(data));

      const result = withLogging('hello');
      expect(result).toBe('HELLO');

      console.log = originalLog;
    });
  });
});

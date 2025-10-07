import { describe, it, expect, vi } from 'vitest';
import { randomArrItem } from '../../src/lib/array';

describe('array utilities', () => {
  describe('randomArrItem', () => {
    it('should return an item from the array', () => {
      const testArray = ['apple', 'banana', 'cherry'];
      const result = randomArrItem(testArray);
      
      expect(testArray).toContain(result);
    });

    it('should return the only item in a single-item array', () => {
      const testArray = ['only-item'];
      const result = randomArrItem(testArray);
      
      expect(result).toBe('only-item');
    });

    it('should work with different data types', () => {
      const numberArray = [1, 2, 3, 4, 5];
      const result = randomArrItem(numberArray);
      
      expect(numberArray).toContain(result);
      expect(typeof result).toBe('number');
    });

    it('should work with object arrays', () => {
      const objectArray = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' }
      ];
      const result = randomArrItem(objectArray);
      
      expect(objectArray).toContain(result);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    });

    it('should use Math.random and Math.floor correctly', () => {
      const mathRandomSpy = vi.spyOn(Math, 'random');
      const mathFloorSpy = vi.spyOn(Math, 'floor');
      
      mathRandomSpy.mockReturnValue(0.5);
      
      const testArray = ['a', 'b', 'c', 'd'];
      randomArrItem(testArray);
      
      expect(mathRandomSpy).toHaveBeenCalled();
      expect(mathFloorSpy).toHaveBeenCalledWith(2); // 0.5 * 4 = 2
      
      mathRandomSpy.mockRestore();
      mathFloorSpy.mockRestore();
    });

    it('should handle edge case with Math.random returning 0', () => {
      const mathRandomSpy = vi.spyOn(Math, 'random');
      mathRandomSpy.mockReturnValue(0);
      
      const testArray = ['first', 'second', 'third'];
      const result = randomArrItem(testArray);
      
      expect(result).toBe('first');
      
      mathRandomSpy.mockRestore();
    });

    it('should handle edge case with Math.random returning close to 1', () => {
      const mathRandomSpy = vi.spyOn(Math, 'random');
      mathRandomSpy.mockReturnValue(0.999);
      
      const testArray = ['first', 'second', 'third'];
      const result = randomArrItem(testArray);
      
      expect(result).toBe('third');
      
      mathRandomSpy.mockRestore();
    });
  });
});

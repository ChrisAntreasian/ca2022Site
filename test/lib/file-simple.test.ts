import { describe, it, expect } from 'vitest';
import { mkKeyWDefault } from '../../src/lib/file';

describe('mkKeyWDefault simple test', () => {
  it('works with basic route', () => {
    const result = mkKeyWDefault('routes/landing/data');
    expect(result).toBe('landing');
  });
});

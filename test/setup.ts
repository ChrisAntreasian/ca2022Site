import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock SvelteKit runtime
vi.mock('$app/environment', () => ({
  browser: false,
  dev: true,
  building: false,
  version: ''
}));

vi.mock('$app/navigation', () => ({
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  preloadData: vi.fn(),
  preloadCode: vi.fn()
}));

vi.mock('$app/stores', () => ({
  getStores: vi.fn(),
  navigating: { subscribe: vi.fn() },
  page: { subscribe: vi.fn() },
  updated: { subscribe: vi.fn() }
}));

// Mock analytics
vi.mock('$lib/analytics', () => ({
  captureBehavior: vi.fn(),
  captureDetails: vi.fn()
}));

// Mock history
vi.mock('$lib/history', () => ({
  clientNavigate: vi.fn(() => vi.fn())
}));

// Mock spacing utilities - removed to use actual implementation

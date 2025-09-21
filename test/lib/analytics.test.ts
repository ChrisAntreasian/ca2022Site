import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('mixpanel-browser', () => ({
  default: {
    init: vi.fn(),
    track: vi.fn(),
  },
}));

vi.mock('node:crypto', () => ({
  randomBytes: vi.fn(),
}));

vi.mock('$lib/date', () => ({
  daysFromNow: vi.fn(),
}));

// Mock environment variables
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_MIXPANEL_PROJECT_TOKEN: 'test-token',
        PROD: false,
      },
    },
  },
});

import mixpanel from 'mixpanel-browser';
import * as crypto from 'node:crypto';
import { daysFromNow } from '../../src/lib/date';
import {
  initMixpanel,
  initDistinctId,
  captureDetails,
  captureBehavior,
  captureClickThis,
} from '../../src/lib/analytics';

describe('Analytics Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initMixpanel', () => {
    it('initializes mixpanel with project token and debug mode', () => {
      initMixpanel();

      expect(mixpanel.init).toHaveBeenCalledWith('test-token', { debug: true });
    });

    it('uses environment variable for token', () => {
      globalThis.import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN = 'different-token';
      
      initMixpanel();

      expect(mixpanel.init).toHaveBeenCalledWith('different-token', { debug: true });
    });
  });

  describe('initDistinctId', () => {
    let mockCookies: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockCookies = {
        get: vi.fn(),
        set: vi.fn(),
      };

      (crypto.randomBytes as any).mockReturnValue({
        toString: vi.fn().mockReturnValue('mock-random-id'),
      });

      (daysFromNow as any).mockReturnValue(new Date('2024-12-31'));
    });

    it('returns early if distinctId cookie already exists', async () => {
      mockCookies.get.mockReturnValue('existing-id');

      await initDistinctId(mockCookies as any);

      expect(mockCookies.get).toHaveBeenCalledWith('distinctId');
      expect(mockCookies.set).not.toHaveBeenCalled();
      expect(crypto.randomBytes).not.toHaveBeenCalled();
    });

    it('creates new distinctId if cookie does not exist', async () => {
      mockCookies.get.mockReturnValue(undefined);

      await initDistinctId(mockCookies as any);

      expect(mockCookies.get).toHaveBeenCalledWith('distinctId');
      expect(crypto.randomBytes).toHaveBeenCalledWith(20);
      expect(mockCookies.set).toHaveBeenCalledWith('distinctId', 'mock-random-id', {
        path: '/',
        expires: new Date('2024-12-31'),
      });
      expect(daysFromNow).toHaveBeenCalledWith(400);
    });

    it('generates hex string from random bytes', async () => {
      mockCookies.get.mockReturnValue(undefined);
      const mockBuffer = {
        toString: vi.fn().mockReturnValue('hex-string-id'),
      };
      (crypto.randomBytes as any).mockReturnValue(mockBuffer);

      await initDistinctId(mockCookies as any);

      expect(mockBuffer.toString).toHaveBeenCalledWith('hex');
      expect(mockCookies.set).toHaveBeenCalledWith('distinctId', 'hex-string-id', expect.any(Object));
    });
  });

  describe('captureDetails', () => {
    it('creates details object with id and name', () => {
      const result = captureDetails({ id: 123, name: 'Test Item' });

      expect(result).toEqual({
        resourceId: 123,
        resourceName: 'Test Item',
      });
    });

    it('merges additional properties', () => {
      const result = captureDetails(
        { id: 456, name: 'Another Item' },
        { category: 'test', priority: 'high' }
      );

      expect(result).toEqual({
        category: 'test',
        priority: 'high',
        resourceId: 456,
        resourceName: 'Another Item',
      });
    });

    it('handles empty additional properties', () => {
      const result = captureDetails({ id: 789, name: 'Item' }, {});

      expect(result).toEqual({
        resourceId: 789,
        resourceName: 'Item',
      });
    });

    it('additional properties can override resource properties', () => {
      const result = captureDetails(
        { id: 999, name: 'Original Name' },
        { resourceName: 'Overridden Name', extra: 'data' }
      );

      expect(result).toEqual({
        resourceName: 'Overridden Name',
        extra: 'data',
        resourceId: 999,
      });
    });
  });

  describe('captureBehavior', () => {
    beforeEach(() => {
      globalThis.import.meta.env.PROD = false;
    });

    it('does not track in non-production environment', async () => {
      globalThis.import.meta.env.PROD = false;

      await captureBehavior('test-event', { data: 'test' });

      expect(mixpanel.track).not.toHaveBeenCalled();
    });

    it('tracks events in production environment', async () => {
      globalThis.import.meta.env.PROD = true;

      await captureBehavior('test-event', { data: 'test' });

      expect(mixpanel.track).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('handles undefined props', async () => {
      globalThis.import.meta.env.PROD = true;

      await captureBehavior('test-event');

      expect(mixpanel.track).toHaveBeenCalledWith('test-event', {});
    });

    it('handles complex props object', async () => {
      globalThis.import.meta.env.PROD = true;
      const complexProps = {
        user: { id: 123, name: 'John' },
        action: 'click',
        metadata: ['tag1', 'tag2'],
      };

      await captureBehavior('complex-event', complexProps);

      expect(mixpanel.track).toHaveBeenCalledWith('complex-event', complexProps);
    });
  });

  describe('captureClickThis', () => {
    beforeEach(() => {
      globalThis.import.meta.env.PROD = true;
    });

    it('creates a curried function for click tracking', () => {
      const clickTracker = captureClickThis('button');

      expect(typeof clickTracker).toBe('function');
    });

    it('tracks click events with combined strings', () => {
      const clickTracker = captureClickThis('button');
      clickTracker('submit');

      expect(mixpanel.track).toHaveBeenCalledWith('click button submit', {});
    });

    it('can be used with different components', () => {
      const buttonTracker = captureClickThis('button');
      const linkTracker = captureClickThis('link');

      buttonTracker('login');
      linkTracker('navigation');

      expect(mixpanel.track).toHaveBeenCalledWith('click button login', {});
      expect(mixpanel.track).toHaveBeenCalledWith('click link navigation', {});
    });

    it('respects production environment check', () => {
      globalThis.import.meta.env.PROD = false;

      const clickTracker = captureClickThis('button');
      clickTracker('test');

      expect(mixpanel.track).not.toHaveBeenCalled();
    });

    it('handles empty strings', () => {
      const clickTracker = captureClickThis('');
      clickTracker('action');

      expect(mixpanel.track).toHaveBeenCalledWith('click  action', {});
    });

    it('creates reusable tracker functions', () => {
      const headerTracker = captureClickThis('header');

      headerTracker('logo');
      headerTracker('menu');
      headerTracker('search');

      expect(mixpanel.track).toHaveBeenCalledTimes(3);
      expect(mixpanel.track).toHaveBeenNthCalledWith(1, 'click header logo', {});
      expect(mixpanel.track).toHaveBeenNthCalledWith(2, 'click header menu', {});
      expect(mixpanel.track).toHaveBeenNthCalledWith(3, 'click header search', {});
    });
  });

  describe('Analytics workflow integration', () => {
    it('can combine captureDetails with captureBehavior', async () => {
      globalThis.import.meta.env.PROD = true;

      const details = captureDetails({ id: 123, name: 'Test Article' }, { category: 'blog' });
      await captureBehavior('view-article', details);

      expect(mixpanel.track).toHaveBeenCalledWith('view-article', {
        category: 'blog',
        resourceId: 123,
        resourceName: 'Test Article',
      });
    });

    it('supports complete analytics flow', async () => {
      globalThis.import.meta.env.PROD = true;
      const mockCookies = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
      };

      // Initialize analytics
      initMixpanel();
      await initDistinctId(mockCookies as any);

      // Capture behavior
      const clickTracker = captureClickThis('gallery');
      clickTracker('image');

      // Verify initialization and tracking
      expect(mixpanel.init).toHaveBeenCalledWith('test-token', { debug: true });
      expect(mockCookies.set).toHaveBeenCalled();
      expect(mixpanel.track).toHaveBeenCalledWith('click gallery image', {});
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mixpanel-browser
const mockMixpanel = {
  init: vi.fn(),
  track: vi.fn()
};
vi.mock('mixpanel-browser', () => ({
  default: mockMixpanel
}));

import {
  captureDetails,
  captureBehavior,
  captureClickThis,
} from '../../src/lib/analytics';

describe('Analytics Module Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PROD', false);
  });

  describe('captureDetails', () => {
    it('captures resource details with ID and name', () => {
      const resource = { id: 123, name: 'Test Resource' };
      const result = captureDetails(resource);
      
      expect(result).toEqual({
        resourceId: 123,
        resourceName: 'Test Resource'
      });
    });

    it('merges additional details with resource info', () => {
      const resource = { id: 456, name: 'Another Resource' };
      const additionalDetails = { category: 'art', section: 'gallery' };
      
      const result = captureDetails(resource, additionalDetails);
      
      expect(result).toEqual({
        category: 'art',
        section: 'gallery',
        resourceId: 456,
        resourceName: 'Another Resource'
      });
    });

    it('handles empty additional details', () => {
      const resource = { id: 789, name: 'Empty Details Resource' };
      
      const result = captureDetails(resource, {});
      
      expect(result).toEqual({
        resourceId: 789,
        resourceName: 'Empty Details Resource'
      });
    });

    it('resource properties override additional details with same keys', () => {
      const resource = { id: 999, name: 'Override Test' };
      const conflictingDetails = { resourceId: '111', resourceName: 'Old Name', extra: 'data' };
      
      const result = captureDetails(resource, conflictingDetails);
      
      expect(result).toEqual({
        resourceId: 999, // overridden by resource.id
        resourceName: 'Override Test', // overridden by resource.name
        extra: 'data'
      });
    });
  });

  describe('captureBehavior', () => {
    it('does not track events in non-production environment', async () => {
      vi.stubEnv('PROD', false);
      
      await captureBehavior('test-event', { data: 'test' });
      
      expect(mockMixpanel.track).not.toHaveBeenCalled();
    });

    it('tracks events in production environment', async () => {
      vi.stubEnv('PROD', true);
      
      const eventKey = 'user-click';
      const props = { button: 'submit', page: 'contact' };
      
      await captureBehavior(eventKey, props);
      
      expect(mockMixpanel.track).toHaveBeenCalledWith(eventKey, props);
    });

    it('tracks events without props in production', async () => {
      vi.stubEnv('PROD', true);
      
      await captureBehavior('simple-event');
      
      expect(mockMixpanel.track).toHaveBeenCalledWith('simple-event', {});
    });

    it('handles undefined props correctly', async () => {
      vi.stubEnv('PROD', true);
      
      await captureBehavior('undefined-props-event', undefined);
      
      expect(mockMixpanel.track).toHaveBeenCalledWith('undefined-props-event', {});
    });
  });

  describe('captureClickThis', () => {
    beforeEach(() => {
      vi.stubEnv('PROD', true);
    });

    it('creates a curried function for click tracking', () => {
      const clickTracker = captureClickThis('gallery');
      
      expect(typeof clickTracker).toBe('function');
    });

    it('tracks click events with composed event key', () => {
      const clickTracker = captureClickThis('article');
      
      clickTracker('navigation');
      
      expect(mockMixpanel.track).toHaveBeenCalledWith('click article navigation', {});
    });

    it('handles multiple click types for same component', () => {
      const galleryClick = captureClickThis('gallery');
      
      galleryClick('next');
      galleryClick('previous');
      galleryClick('thumbnail');
      
      expect(mockMixpanel.track).toHaveBeenCalledTimes(3);
      expect(mockMixpanel.track).toHaveBeenNthCalledWith(1, 'click gallery next', {});
      expect(mockMixpanel.track).toHaveBeenNthCalledWith(2, 'click gallery previous', {});
      expect(mockMixpanel.track).toHaveBeenNthCalledWith(3, 'click gallery thumbnail', {});
    });

    it('respects production environment check', () => {
      vi.stubEnv('PROD', false);
      
      const clickTracker = captureClickThis('test');
      clickTracker('button');
      
      expect(mockMixpanel.track).not.toHaveBeenCalled();
    });

    it('handles empty component names', () => {
      const clickTracker = captureClickThis('');
      clickTracker('action');

      expect(mockMixpanel.track).toHaveBeenCalledWith('click  action', {});
    });
  });

  describe('Analytics workflow integration', () => {
    it('can combine captureDetails with captureBehavior', async () => {
      vi.stubEnv('PROD', true);

      const details = captureDetails({ id: 123, name: 'Test Article' }, { category: 'blog' });
      await captureBehavior('view-article', details);

      expect(mockMixpanel.track).toHaveBeenCalledWith('view-article', {
        category: 'blog',
        resourceId: 123,
        resourceName: 'Test Article',
      });
    });

    it('creates reusable tracker functions', () => {
      vi.stubEnv('PROD', true);
      const headerTracker = captureClickThis('header');

      headerTracker('logo');
      headerTracker('menu');
      headerTracker('search');

      expect(mockMixpanel.track).toHaveBeenCalledTimes(3);
      expect(mockMixpanel.track).toHaveBeenNthCalledWith(1, 'click header logo', {});
      expect(mockMixpanel.track).toHaveBeenNthCalledWith(2, 'click header menu', {});
      expect(mockMixpanel.track).toHaveBeenNthCalledWith(3, 'click header search', {});
    });
  });
});

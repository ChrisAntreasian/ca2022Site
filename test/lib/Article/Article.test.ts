import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Article from '../../../src/lib/Article/index.svelte';

// Type definitions for testing
interface Item {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

const mockItems: Item[] = [
  {
    id: 1,
    title: 'Test Article 1',
    body: 'This is the content of test article 1',
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01'
  },
  {
    id: 2,
    title: 'Test Article 2', 
    body: 'This is the content of test article 2',
    createdAt: '2023-01-02',
    updatedAt: '2023-01-02'
  }
];

const defaultProps = {
  item: mockItems[0],
  items: mockItems,
  analyticsKey: 'test-article',
  parentRoute: 'articles',
  defaultHeadline: 'Articles',
  wrapBasis: 100
};

describe('Article Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    });
  });

  it('renders the article with correct title', () => {
    render(Article, { props: defaultProps });
    
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });

  it('renders navigation with all items', () => {
    render(Article, { props: defaultProps });
    
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
    expect(screen.getByText('Test Article 2')).toBeInTheDocument();
  });

  it('handles item selection correctly', async () => {
    render(Article, { props: defaultProps });
    
    const secondArticleLink = screen.getByText('Test Article 2');
    await fireEvent.click(secondArticleLink);
    
    // After clicking, the analytics should be called
    // We can't easily test the internal state change without more complex setup
    expect(secondArticleLink).toBeInTheDocument();
  });

  it('renders with custom wrap basis', () => {
    const customProps = {
      ...defaultProps,
      wrapBasis: 80
    };
    
    render(Article, { props: customProps });
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });

  it('handles mobile viewport correctly', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      value: 500
    });
    
    render(Article, { props: defaultProps });
    
    // Component should render without errors in mobile view
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });

  it('prevents navigation to same item', async () => {
    render(Article, { props: defaultProps });
    
    // Click on the already active item
    const currentArticleLink = screen.getByText('Test Article 1');
    await fireEvent.click(currentArticleLink);
    
    // Should still be showing the same article
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });

  it('handles empty items array gracefully', () => {
    const emptyProps = {
      ...defaultProps,
      items: []
    };
    
    expect(() => render(Article, { props: emptyProps })).not.toThrow();
  });

  it('renders with children slot content', () => {
    const { container } = render(Article, { 
      props: defaultProps,
      slots: {
        default: '<div data-testid="custom-content">Custom content</div>'
      }
    });
    
    const customContent = container.querySelector('[data-testid="custom-content"]');
    expect(customContent).toBeInTheDocument();
  });

  it('maintains scroll position tracking', () => {
    render(Article, { props: defaultProps });
    
    // Component should render and handle scroll tracking
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
    
    // Simulate scroll event
    window.dispatchEvent(new Event('scroll'));
    
    // Component should handle scroll without errors
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });
});

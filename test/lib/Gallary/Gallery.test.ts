import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Gallery from '../../../src/lib/Gallary/index.svelte';

// Type definitions for testing
interface ArtWithId {
  id: number;
  attributes: {
    title: string;
    description: string;
    order: number;
    createdDate: string;
    medium: string;
    image: {
      data: {
        id: number;
        attributes: {
          url: string;
          alternativeText: string;
          caption: string;
          provider: string;
          provider_metadata: unknown;
          previewUrl: string | null;
          formats: unknown;
          createdAt: string;
          updatedAt: string;
        };
      } | null;
    };
    createdAt: string;
    updatedAt: string;
  };
}

// Mock data for testing
const mockArtPieces: ArtWithId[] = [
  {
    id: 1,
    attributes: {
      title: 'Test Art 1',
      description: 'Test description 1',
      order: 1,
      createdDate: '2023-01-01',
      medium: 'Oil on canvas',
      image: {
        data: {
          id: 1,
          attributes: {
            url: '/test-image-1.jpg',
            alternativeText: 'Test alt text 1',
            caption: 'Test caption',
            provider: 'local',
            provider_metadata: null,
            previewUrl: null,
            formats: null,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01'
          }
        }
      },
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01'
    }
  },
  {
    id: 2,
    attributes: {
      title: 'Test Art 2',
      description: 'Test description 2',
      order: 2,
      createdDate: '2023-01-02',
      medium: 'Watercolor',
      image: {
        data: {
          id: 2,
          attributes: {
            url: '/test-image-2.jpg',
            alternativeText: 'Test alt text 2',
            caption: 'Test caption 2',
            provider: 'local',
            provider_metadata: null,
            previewUrl: null,
            formats: null,
            createdAt: '2023-01-02',
            updatedAt: '2023-01-02'
          }
        }
      },
      createdAt: '2023-01-02',
      updatedAt: '2023-01-02'
    }
  }
];

const defaultProps = {
  artPieces: mockArtPieces,
  artPiece: mockArtPieces[0],
  parentRoute: '/gallery',
  analyticsKey: 'test-gallery',
  categoryTitle: 'Test Gallery',
  hideMobileTitle: false,
  useUrlTitle: true
};

// Mock context
vi.mock('svelte', async () => {
  const actual = await vi.importActual('svelte');
  return {
    ...actual,
    getContext: vi.fn(() => ({
      getFooterHeight: () => 100
    }))
  };
});

describe('Gallery Component', () => {
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

  it('renders the gallery with art piece', () => {
    render(Gallery, { props: defaultProps });
    
    expect(screen.getByText('Test Art 1')).toBeInTheDocument();
    expect(screen.getByAltText('Test description 1')).toBeInTheDocument();
  });

  it('displays art piece metadata correctly', () => {
    render(Gallery, { props: defaultProps });
    
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('Oil on canvas')).toBeInTheDocument();
  });

  it('shows pagination controls when there are multiple pieces', () => {
    render(Gallery, { props: defaultProps });
    
    // Should show "next" button since we're on the first item
    expect(screen.getByText('next')).toBeInTheDocument();
  });

  it('handles pagination correctly', async () => {
    render(Gallery, { props: defaultProps });
    
    const nextButton = screen.getByText('next');
    await fireEvent.click(nextButton);
    
    // Should now show "last" button since we moved to second item
    expect(screen.getByText('last')).toBeInTheDocument();
  });

  it('preloads images for performance', () => {
    render(Gallery, { props: defaultProps });
    
    const preloadLinks = document.querySelectorAll('link[rel="preload"][as="image"]');
    expect(preloadLinks).toHaveLength(mockArtPieces.length);
  });

  it('calculates pagination details correctly', () => {
    render(Gallery, { props: defaultProps });
    
    // Test internal state through component behavior
    expect(screen.getByText('next')).toBeInTheDocument();
    expect(screen.queryByText('last')).not.toBeInTheDocument();
  });

  it('handles mobile view appropriately', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      value: 500
    });
    
    render(Gallery, { props: { ...defaultProps, hideMobileTitle: true } });
    
    // Component should render without errors in mobile view
    expect(screen.getByText('Test Art 1')).toBeInTheDocument();
  });

  it('handles read more functionality', async () => {
    render(Gallery, { props: defaultProps });
    
    // Look for read more button if content is long enough
    const readMoreButton = screen.queryByText('read more');
    if (readMoreButton) {
      await fireEvent.click(readMoreButton);
      expect(screen.getByText('read less')).toBeInTheDocument();
    }
  });

  it('handles empty art pieces gracefully', () => {
    const emptyProps = {
      ...defaultProps,
      artPieces: [],
      artPiece: mockArtPieces[0] // Still provide current piece
    };
    
    expect(() => render(Gallery, { props: emptyProps })).not.toThrow();
  });

  it('handles missing image data gracefully', () => {
    const propsWithMissingImage = {
      ...defaultProps,
      artPiece: {
        ...mockArtPieces[0],
        attributes: {
          ...mockArtPieces[0].attributes,
          image: { data: null }
        }
      }
    };
    
    expect(() => render(Gallery, { props: propsWithMissingImage })).not.toThrow();
  });
});

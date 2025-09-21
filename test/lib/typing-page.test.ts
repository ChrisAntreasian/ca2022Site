import { describe, it, expect } from 'vitest';
import { either as E } from 'fp-ts';
import {
  pageResC,
  detailsResC,
  type PageRes,
  type DetailsRes,
  type StrapiPageDetails
} from '../../src/lib/typing/page';

describe('Page Type Validation', () => {
  describe('pageResC codec', () => {
    it('validates complete page response structure', () => {
      const validPageRes = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Homepage',
              page_details: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Welcome Section',
                      description: 'Welcome to our website',
                      link: 'https://example.com',
                      art_categories: undefined,
                      poems: undefined,
                      art_piece: undefined,
                      image: undefined
                    }
                  }
                ]
              },
              rich_links: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'External Link',
                      body: 'Link description',
                      image: { data: [] },
                      logo: { data: null },
                      link: 'https://external.com',
                      secondLink: null,
                      position: 1
                    }
                  }
                ]
              }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = pageResC.decode(validPageRes);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const typed: PageRes = result.right;
        expect(typed.data).toHaveLength(1);
        expect(typed.meta.pagination.total).toBe(1);
        
        if (typed.data && typed.data[0]) {
          expect(typed.data[0].attributes.title).toBe('Homepage');
          expect(typed.data[0].attributes.page_details.data).toHaveLength(1);
        }
      }
    });

    it('validates page with undefined rich_links', () => {
      const pageWithoutRichLinks = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Simple Page',
              page_details: {
                data: []
              },
              rich_links: undefined
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = pageResC.decode(pageWithoutRichLinks);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          expect(result.right.data[0].attributes.rich_links).toBeUndefined();
        }
      }
    });

    it('validates empty page data', () => {
      const emptyPageData = {
        data: [],
        meta: {
          pagination: {
            page: 1,
            pageCount: 0,
            pageSize: 25,
            total: 0
          }
        }
      };

      const result = pageResC.decode(emptyPageData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.data).toHaveLength(0);
      }
    });

    it('rejects invalid page structure', () => {
      const invalidPage = {
        data: [
          {
            id: 'invalid-id', // should be number
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Invalid Page',
              page_details: { data: [] }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = pageResC.decode(invalidPage);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('detailsResC codec', () => {
    it('validates page details response with art categories', () => {
      const detailsWithArt = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Art Gallery',
              description: 'Browse our art collection',
              link: null,
              art_categories: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Paintings',
                      art_pieces: undefined,
                      omit: undefined
                    }
                  }
                ]
              },
              poems: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Sample Poem',
                      body: 'Sample poem content',
                      featured: true,
                      position: 1
                    }
                  }
                ]
              },
              art_piece: undefined,
              image: undefined
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(detailsWithArt);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const typed: DetailsRes = result.right;
        expect(typed.data).toHaveLength(1);
        
        if (typed.data && typed.data[0]) {
          expect(typed.data[0].attributes.title).toBe('Art Gallery');
          expect(typed.data[0].attributes.art_categories?.data).toHaveLength(1);
          expect(typed.data[0].attributes.poems.data).toHaveLength(1);
        }
      }
    });

    it('validates page details with single art piece', () => {
      const detailsWithArtPiece = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Featured Art',
              description: 'A single featured artwork',
              link: null,
              art_categories: undefined,
              poems: {
                data: []
              },
              art_piece: {
                data: {
                  id: 1,
                  attributes: {
                    createdAt: '2023-12-01T10:00:00.000Z',
                    updatedAt: '2023-12-01T15:30:00.000Z',
                    publishedAt: '2023-12-01T16:00:00.000Z',
                    description: 'Beautiful artwork',
                    order: 1,
                    image: { data: null },
                    title: 'Masterpiece',
                    createdDate: '2023-01-01',
                    medium: 'Oil on canvas'
                  }
                }
              },
              image: {
                data: {
                  id: 1,
                  attributes: {
                    createdAt: '2023-12-01T10:00:00.000Z',
                    updatedAt: '2023-12-01T15:30:00.000Z',
                    alternativeText: 'Page header image',
                    caption: 'Header',
                    provider: 'local',
                    provider_metadata: null,
                    previewUrl: null,
                    url: '/header.jpg',
                    formats: null
                  }
                }
              }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(detailsWithArtPiece);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          expect(result.right.data[0].attributes.art_piece?.data?.attributes.title).toBe('Masterpiece');
          expect(result.right.data[0].attributes.image?.data?.attributes.alternativeText).toBe('Page header image');
        }
      }
    });

    it('validates page details with empty poems array', () => {
      const detailsWithEmptyPoems = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'No Poems Page',
              description: 'A page without poems',
              link: 'https://example.com',
              art_categories: undefined,
              poems: { data: [] },  // Empty array required for detailsResC
              art_piece: undefined,
              image: undefined
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(detailsWithEmptyPoems);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          expect(result.right.data[0].attributes.poems.data).toHaveLength(0);
        }
      }
    });

    it('validates null link field', () => {
      const detailsWithNullLink = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'No Link Page',
              description: 'Page without external link',
              link: null,
              art_categories: undefined,
              poems: { data: [] },
              art_piece: undefined,
              image: undefined
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(detailsWithNullLink);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          expect(result.right.data[0].attributes.link).toBeNull();
        }
      }
    });

    it('rejects invalid page details structure', () => {
      const invalidDetails = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 123, // should be string
              description: 'Valid description',
              link: null,
              poems: { data: [] }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(invalidDetails);
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('Rich Link Validation', () => {
    it('validates rich link with all fields', () => {
      const richLinkData = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Rich Link',
              page_details: { data: [] },
              rich_links: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'External Resource',
                      body: 'Detailed description of the external resource',
                      image: {
                        data: [
                          {
                            id: 1,
                            attributes: {
                              ext: '.jpg',
                              height: 400,
                              hash: 'image_hash',
                              mime: 'image/jpeg',
                              name: 'resource.jpg',
                              size: 51200,
                              url: '/resource.jpg',
                              width: 600,
                              path: null
                            }
                          }
                        ]
                      },
                      logo: {
                        data: {
                          id: 2,
                          attributes: {
                            ext: '.png',
                            height: 100,
                            hash: 'logo_hash',
                            mime: 'image/png',
                            name: 'logo.png',
                            size: 5120,
                            url: '/logo.png',
                            width: 100,
                            path: null
                          }
                        }
                      },
                      link: 'https://external-resource.com',
                      secondLink: 'https://backup-link.com',
                      position: 1
                    }
                  }
                ]
              }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = pageResC.decode(richLinkData);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          const richLinks = result.right.data[0].attributes.rich_links;
          if (richLinks && richLinks.data && richLinks.data[0]) {
            expect(richLinks.data[0].attributes.title).toBe('External Resource');
            expect(richLinks.data[0].attributes.secondLink).toBe('https://backup-link.com');
            expect(richLinks.data[0].attributes.position).toBe(1);
          }
        }
      }
    });

    it('validates rich link with null secondLink', () => {
      const richLinkWithNullSecond = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Single Link',
              page_details: { data: [] },
              rich_links: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Single Resource',
                      body: 'Resource with only one link',
                      image: { data: [] },
                      logo: { data: null },
                      link: 'https://single-resource.com',
                      secondLink: null,
                      position: 2
                    }
                  }
                ]
              }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = pageResC.decode(richLinkWithNullSecond);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          const richLinks = result.right.data[0].attributes.rich_links;
          if (richLinks && richLinks.data && richLinks.data[0]) {
            expect(richLinks.data[0].attributes.secondLink).toBeNull();
          }
        }
      }
    });
  });

  describe('Type Aliases and Integration', () => {
    it('uses PageRes type correctly', () => {
      const pageRes: PageRes = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Test Page',
              page_details: { data: [] },
              rich_links: undefined
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      // This should compile without issues
      expect(pageRes.data).toHaveLength(1);
      if (pageRes.data && pageRes.data[0]) {
        expect(pageRes.data[0].attributes.title).toBe('Test Page');
      }
    });

    it('uses DetailsRes type correctly', () => {
      const detailsRes: DetailsRes = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Details Test',
              description: 'Test description',
              link: null,
              art_categories: undefined,
              poems: { data: [] },
              art_piece: undefined,
              image: undefined
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      // This should compile without issues
      expect(detailsRes.data).toHaveLength(1);
      if (detailsRes.data && detailsRes.data[0]) {
        expect(detailsRes.data[0].attributes.title).toBe('Details Test');
      }
    });

    it('uses StrapiPageDetails type correctly', () => {
      const pageDetails: StrapiPageDetails = [
        {
          id: 1,
          attributes: {
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T15:30:00.000Z',
            publishedAt: '2023-12-01T16:00:00.000Z',
            title: 'Page Details Test',
            description: 'Test page details',
            link: 'https://test.com',
            art_categories: undefined,
            poems: { data: [] },
            art_piece: undefined,
            image: undefined
          }
        }
      ];

      // This should compile without issues
      expect(pageDetails).toHaveLength(1);
      expect(pageDetails[0].attributes.title).toBe('Page Details Test');
    });
  });

  describe('Complex nested validation scenarios', () => {
    it('validates complex page with all possible fields', () => {
      const complexPage = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Complex Page',
              description: 'A page with all possible content types',
              link: 'https://example.com',
              art_categories: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Mixed Media',
                      art_pieces: {
                        data: [
                          {
                            id: 1,
                            attributes: {
                              createdAt: '2023-12-01T10:00:00.000Z',
                              updatedAt: '2023-12-01T15:30:00.000Z',
                              publishedAt: '2023-12-01T16:00:00.000Z',
                              description: 'Abstract piece',
                              order: 1,
                              image: { data: null },
                              title: 'Abstract #1',
                              createdDate: '2023-01-15',
                              medium: 'Acrylic'
                            }
                          }
                        ]
                      },
                      omit: undefined
                    }
                  }
                ]
              },
              poems: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Nature\'s Call',
                      body: 'Wind whispers through the trees,\nNature calls to wandering souls.',
                      featured: true,
                      position: 1
                    }
                  }
                ]
              },
              art_piece: {
                data: {
                  id: 2,
                  attributes: {
                    createdAt: '2023-12-01T10:00:00.000Z',
                    updatedAt: '2023-12-01T15:30:00.000Z',
                    publishedAt: '2023-12-01T16:00:00.000Z',
                    description: 'Featured artwork',
                    order: 1,
                    image: {
                      data: {
                        id: 1,
                        attributes: {
                          createdAt: '2023-12-01T10:00:00.000Z',
                          updatedAt: '2023-12-01T15:30:00.000Z',
                          alternativeText: 'Featured art image',
                          caption: 'Main artwork',
                          provider: 'local',
                          provider_metadata: null,
                          previewUrl: null,
                          url: '/featured-art.jpg',
                          formats: null
                        }
                      }
                    },
                    title: 'Featured Masterpiece',
                    createdDate: '2023-02-01',
                    medium: 'Mixed media'
                  }
                }
              },
              image: {
                data: {
                  id: 2,
                  attributes: {
                    createdAt: '2023-12-01T10:00:00.000Z',
                    updatedAt: '2023-12-01T15:30:00.000Z',
                    alternativeText: 'Page banner',
                    caption: 'Complex page banner',
                    provider: 'cloudinary',
                    provider_metadata: { public_id: 'banner_123' },
                    previewUrl: '/banner-preview.jpg',
                    url: '/banner-full.jpg',
                    formats: {
                      small: {
                        ext: '.jpg',
                        height: 200,
                        hash: 'small_banner_hash',
                        mime: 'image/jpeg',
                        name: 'banner-small.jpg',
                        size: 15360,
                        url: '/banner-small.jpg',
                        width: 400,
                        path: null
                      },
                      thumbnail: {
                        ext: '.jpg',
                        height: 75,
                        hash: 'thumb_banner_hash',
                        mime: 'image/jpeg',
                        name: 'banner-thumb.jpg',
                        size: 3840,
                        url: '/banner-thumb.jpg',
                        width: 150,
                        path: null
                      }
                    }
                  }
                }
              }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(complexPage);
      
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        if (result.right.data && result.right.data[0]) {
          const page = result.right.data[0].attributes;
          expect(page.title).toBe('Complex Page');
          expect(page.art_categories?.data).toHaveLength(1);
          expect(page.poems.data).toHaveLength(1);
          expect(page.art_piece?.data?.attributes.title).toBe('Featured Masterpiece');
          expect(page.image?.data?.attributes.alternativeText).toBe('Page banner');
        }
      }
    });

    it('handles validation failures in deeply nested structures', () => {
      const invalidNestedPage = {
        data: [
          {
            id: 1,
            attributes: {
              createdAt: '2023-12-01T10:00:00.000Z',
              updatedAt: '2023-12-01T15:30:00.000Z',
              publishedAt: '2023-12-01T16:00:00.000Z',
              title: 'Invalid Nested',
              description: 'Page with invalid nested data',
              link: null,
              poems: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Valid Poem',
                      body: 'Valid content',
                      featured: true,
                      position: 1
                    }
                  },
                  {
                    id: 'invalid', // should be number
                    attributes: {
                      createdAt: '2023-12-01T10:00:00.000Z',
                      updatedAt: '2023-12-01T15:30:00.000Z',
                      publishedAt: '2023-12-01T16:00:00.000Z',
                      title: 'Invalid Poem',
                      body: 'Invalid content',
                      featured: 'yes', // should be boolean
                      position: 2
                    }
                  }
                ]
              }
            }
          }
        ],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 25,
            total: 1
          }
        }
      };

      const result = detailsResC.decode(invalidNestedPage);
      expect(E.isLeft(result)).toBe(true);
    });
  });
});

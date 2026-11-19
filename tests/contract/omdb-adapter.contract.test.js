import { describe, expect, it, vi } from 'vitest'
import { createOmdbClient, OmdbClientError } from '../../src/shared/api/omdb/client'

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('OMDb adapter contract', () => {
  it('maps search payload to normalized media list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        Search: [
          {
            Title: 'The Matrix',
            Year: '1999',
            imdbID: 'tt0133093',
            Type: 'movie',
            Poster: 'https://example.com/poster.jpg',
          },
        ],
        totalResults: '1',
        Response: 'True',
      }),
    )

    const client = createOmdbClient({
      apiKey: 'valid-key',
      baseUrl: 'https://www.omdbapi.com/',
      fetchImpl,
    })

    const result = await client.searchMedia({
      query: 'matrix',
      type: 'movie',
      page: 1,
    })

    expect(result.totalResults).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'tt0133093',
      type: 'movie',
      title: 'The Matrix',
      year: '1999',
      posterUrl: 'https://example.com/poster.jpg',
      plot: null,
      genres: [],
      imdbRating: null,
    })

    const [requestUrl] = fetchImpl.mock.calls[0]
    const parsedUrl = new URL(requestUrl)
    expect(parsedUrl.searchParams.get('apikey')).toBe('valid-key')
    expect(parsedUrl.searchParams.get('s')).toBe('matrix')
    expect(parsedUrl.searchParams.get('type')).toBe('movie')
    expect(parsedUrl.searchParams.get('page')).toBe('1')
  })

  it('maps detail payload to normalized media shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        Title: 'The Matrix',
        Year: '1999',
        imdbID: 'tt0133093',
        Type: 'movie',
        Poster: 'https://example.com/poster.jpg',
        Plot: 'A computer hacker learns ...',
        Genre: 'Action, Sci-Fi',
        imdbRating: '8.7',
        Response: 'True',
      }),
    )

    const client = createOmdbClient({
      apiKey: 'valid-key',
      fetchImpl,
    })

    const result = await client.getMediaDetails({
      imdbId: 'tt0133093',
      plot: 'full',
    })

    expect(result).toMatchObject({
      id: 'tt0133093',
      type: 'movie',
      title: 'The Matrix',
      year: '1999',
      posterUrl: 'https://example.com/poster.jpg',
      plot: 'A computer hacker learns ...',
      genres: ['Action', 'Sci-Fi'],
      imdbRating: 8.7,
    })
  })

  it('normalizes unauthorized error when API key is missing', async () => {
    const client = createOmdbClient({
      apiKey: '',
      fetchImpl: vi.fn(),
    })

    await expect(client.searchMedia({ query: 'matrix' })).rejects.toMatchObject({
      kind: 'unauthorized',
      retryable: false,
    })
  })

  it('normalizes not_found and rate_limited errors from OMDb payload/http', async () => {
    const notFoundClient = createOmdbClient({
      apiKey: 'valid-key',
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({
          Response: 'False',
          Error: 'Movie not found!',
        }),
      ),
    })

    await expect(notFoundClient.searchMedia({ query: 'xxxxx' })).rejects.toMatchObject({
      kind: 'not_found',
      retryable: false,
    })

    const rateLimitedClient = createOmdbClient({
      apiKey: 'valid-key',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ message: 'Slow down' }, 429)),
    })

    await expect(rateLimitedClient.searchMedia({ query: 'matrix' })).rejects.toMatchObject({
      kind: 'rate_limited',
      retryable: true,
      status: 429,
    })
  })

  it('normalizes network_error and invalid_response failures', async () => {
    const networkClient = createOmdbClient({
      apiKey: 'valid-key',
      fetchImpl: vi.fn().mockRejectedValue(new Error('network down')),
    })

    await expect(networkClient.searchMedia({ query: 'matrix' })).rejects.toMatchObject({
      kind: 'network_error',
      retryable: true,
    })

    const invalidPayloadClient = createOmdbClient({
      apiKey: 'valid-key',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(null)),
    })

    await expect(invalidPayloadClient.searchMedia({ query: 'matrix' })).rejects.toMatchObject({
      kind: 'invalid_response',
      retryable: false,
    })
  })

  it('throws OmdbClientError instances', async () => {
    const client = createOmdbClient({
      apiKey: '',
      fetchImpl: vi.fn(),
    })

    try {
      await client.getMediaDetails({ imdbId: 'tt0133093' })
    } catch (error) {
      expect(error).toBeInstanceOf(OmdbClientError)
    }
  })
})

import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../mocks/server'
import {
  createJsonServerClient,
  JsonServerClientError,
} from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'

const BASE_URL = 'http://localhost:3001'

function createDb() {
  return {
    catalogItems: [
      {
        id: 'ci_1',
        userId: 'u_1',
        mediaId: 'tt0133093',
        status: 'watching',
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:10:00.000Z',
      },
    ],
    ratings: [
      {
        id: 'ra_1',
        userId: 'u_1',
        mediaId: 'tt0133093',
        value: 5,
        createdAt: '2026-11-18T12:20:00.000Z',
        updatedAt: '2026-11-18T12:20:00.000Z',
      },
    ],
    reviews: [
      {
        id: 'rv_1',
        userId: 'u_1',
        mediaId: 'tt0133093',
        content: 'Texto com no mínimo 20 caracteres...',
        isDeleted: false,
        createdAt: '2026-11-18T12:30:00.000Z',
        updatedAt: '2026-11-18T12:30:00.000Z',
        publishedAt: '2026-11-18T12:30:00.000Z',
      },
      {
        id: 'rv_deleted',
        userId: 'u_2',
        mediaId: 'tt0133093',
        content: 'Resenha removida logicamente.',
        isDeleted: true,
        createdAt: '2026-11-18T12:30:00.000Z',
        updatedAt: '2026-11-18T12:30:00.000Z',
        publishedAt: '2026-11-18T12:30:00.000Z',
      },
    ],
  }
}

function createHandlers(db) {
  return [
    http.get(`${BASE_URL}/catalogItems`, ({ request }) => {
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      const mediaId = url.searchParams.get('mediaId')
      const items = db.catalogItems.filter((item) => {
        if (userId && item.userId !== userId) {
          return false
        }
        if (mediaId && item.mediaId !== mediaId) {
          return false
        }
        return true
      })
      return HttpResponse.json(items)
    }),
    http.post(`${BASE_URL}/catalogItems`, async ({ request }) => {
      const payload = await request.json()
      const item = {
        id: `ci_${db.catalogItems.length + 1}`,
        ...payload,
      }
      db.catalogItems.push(item)
      return HttpResponse.json(item, { status: 201 })
    }),
    http.patch(`${BASE_URL}/catalogItems/:id`, async ({ request, params }) => {
      const patch = await request.json()
      const item = db.catalogItems.find((entry) => entry.id === params.id)
      Object.assign(item, patch)
      return HttpResponse.json(item)
    }),
    http.delete(`${BASE_URL}/catalogItems/:id`, ({ params }) => {
      db.catalogItems = db.catalogItems.filter((entry) => entry.id !== params.id)
      return HttpResponse.json({}, { status: 200 })
    }),

    http.get(`${BASE_URL}/ratings`, ({ request }) => {
      const url = new URL(request.url)
      const mediaId = url.searchParams.get('mediaId')
      const userId = url.searchParams.get('userId')
      const items = db.ratings.filter((item) => {
        if (mediaId && item.mediaId !== mediaId) {
          return false
        }
        if (userId && item.userId !== userId) {
          return false
        }
        return true
      })
      return HttpResponse.json(items)
    }),
    http.post(`${BASE_URL}/ratings`, async ({ request }) => {
      const payload = await request.json()

      if (payload.value < 1 || payload.value > 5) {
        return HttpResponse.json(
          {
            message: 'value fora de 1..5',
            details: { field: 'value' },
          },
          { status: 422 },
        )
      }

      const rating = {
        id: `ra_${db.ratings.length + 1}`,
        ...payload,
      }
      db.ratings.push(rating)
      return HttpResponse.json(rating, { status: 201 })
    }),
    http.patch(`${BASE_URL}/ratings/:id`, async ({ request, params }) => {
      const patch = await request.json()
      const rating = db.ratings.find((entry) => entry.id === params.id)
      Object.assign(rating, patch)
      return HttpResponse.json(rating)
    }),
    http.delete(`${BASE_URL}/ratings/:id`, ({ params }) => {
      db.ratings = db.ratings.filter((entry) => entry.id !== params.id)
      return HttpResponse.json({}, { status: 200 })
    }),

    http.get(`${BASE_URL}/reviews`, ({ request }) => {
      const url = new URL(request.url)
      const mediaId = url.searchParams.get('mediaId')
      const userId = url.searchParams.get('userId')
      const items = db.reviews.filter((item) => {
        if (mediaId && item.mediaId !== mediaId) {
          return false
        }
        if (userId && item.userId !== userId) {
          return false
        }
        return true
      })
      return HttpResponse.json(items)
    }),
    http.post(`${BASE_URL}/reviews`, async ({ request }) => {
      const payload = await request.json()
      const review = {
        id: `rv_${db.reviews.length + 1}`,
        ...payload,
      }
      db.reviews.push(review)
      return HttpResponse.json(review, { status: 201 })
    }),
    http.patch(`${BASE_URL}/reviews/:id`, async ({ request, params }) => {
      const patch = await request.json()
      const review = db.reviews.find((entry) => entry.id === params.id)
      Object.assign(review, patch)
      return HttpResponse.json(review)
    }),
    http.delete(`${BASE_URL}/reviews/:id`, ({ params }) => {
      db.reviews = db.reviews.filter((entry) => entry.id !== params.id)
      return HttpResponse.json({}, { status: 200 })
    }),
  ]
}

describe('JSON Server resources contract', () => {
  let db
  let resources

  beforeEach(() => {
    db = createDb()
    server.use(...createHandlers(db))

    const client = createJsonServerClient({ baseUrl: BASE_URL })
    resources = createJsonServerResources(client)
  })

  it('supports catalogItems list/create/update/delete flow', async () => {
    const initial = await resources.catalogItems.listByUser('u_1')
    expect(initial).toHaveLength(1)

    const created = await resources.catalogItems.create({
      userId: 'u_1',
      mediaId: 'tt0903747',
      status: 'want_to_watch',
    })

    expect(created).toMatchObject({
      userId: 'u_1',
      mediaId: 'tt0903747',
      status: 'want_to_watch',
    })

    const updated = await resources.catalogItems.updateStatus({
      id: created.id,
      status: 'completed',
    })
    expect(updated.status).toBe('completed')

    await resources.catalogItems.remove(created.id)
    const afterDelete = await resources.catalogItems.findByUserAndMedia({
      userId: 'u_1',
      mediaId: 'tt0903747',
    })
    expect(afterDelete).toBeNull()
  })

  it('supports ratings and normalizes validation errors', async () => {
    const listed = await resources.ratings.listByMedia('tt0133093')
    expect(listed).toHaveLength(1)

    const updated = await resources.ratings.updateValue({
      id: 'ra_1',
      value: 4,
    })
    expect(updated.value).toBe(4)

    await expect(
      resources.ratings.create({
        userId: 'u_2',
        mediaId: 'tt0133093',
        value: 10,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      details: { field: 'value' },
    })
  })

  it('supports reviews list/create/update and soft delete behavior', async () => {
    const publicReviews = await resources.reviews.listByMedia('tt0133093')
    expect(publicReviews.every((review) => review.isDeleted === false)).toBe(true)

    const allReviews = await resources.reviews.listByMedia('tt0133093', {
      includeDeleted: true,
    })
    expect(allReviews.length).toBeGreaterThan(publicReviews.length)

    const created = await resources.reviews.create({
      userId: 'u_3',
      mediaId: 'tt0133093',
      content: 'Essa mídia continua muito boa com o passar do tempo.',
    })
    expect(created.isDeleted).toBe(false)

    const edited = await resources.reviews.updateContent({
      id: created.id,
      content: 'Conteúdo atualizado com mais detalhes sobre a obra.',
    })
    expect(edited.content).toContain('Conteúdo atualizado')

    const deleted = await resources.reviews.remove(created.id, { softDelete: true })
    expect(deleted.isDeleted).toBe(true)
  })

  it('throws JsonServerClientError shape for contract failures', async () => {
    try {
      await resources.ratings.create({
        userId: 'u_2',
        mediaId: 'tt0133093',
        value: 99,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(JsonServerClientError)
      expect(error.code).toBe('VALIDATION_ERROR')
    }
  })
})

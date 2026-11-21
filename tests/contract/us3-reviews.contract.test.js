import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createJsonServerClient,
  JsonServerClientError,
} from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'
import { server } from '../mocks/server'

const BASE_URL = 'http://localhost:3001'
const MEDIA_ID = 'tt0133093'
const OTHER_MEDIA_ID = 'tt0903747'
const ISO = '2026-11-18T12:00:00.000Z'

function createDb() {
  return {
    reviews: [
      {
        id: 'rv_1',
        userId: 'u_1',
        mediaId: MEDIA_ID,
        content: 'Resenha ativa com vinte ou mais caracteres.',
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
      {
        id: 'rv_deleted',
        userId: 'u_2',
        mediaId: MEDIA_ID,
        content: 'Resenha removida logicamente com tamanho válido.',
        isDeleted: true,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
      {
        id: 'rv_other',
        userId: 'u_1',
        mediaId: OTHER_MEDIA_ID,
        content: 'Resenha de outra mídia com tamanho válido.',
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
    ],
  }
}

function createHandlers(db, calls) {
  function record(request, body) {
    const url = new URL(request.url)

    calls.push({
      method: request.method,
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      contentType: request.headers.get('content-type'),
      body,
    })
  }

  return [
    http.get(`${BASE_URL}/reviews`, ({ request }) => {
      record(request)

      const url = new URL(request.url)
      const filters = Object.fromEntries(url.searchParams.entries())
      const reviews = db.reviews.filter((review) =>
        Object.entries(filters).every(
          ([key, value]) => String(review[key]) === value,
        ),
      )

      return HttpResponse.json(reviews)
    }),

    http.post(`${BASE_URL}/reviews`, async ({ request }) => {
      const payload = await request.json()
      record(request, payload)

      const content =
        typeof payload.content === 'string' ? payload.content.trim() : ''

      if (content.length < 20 || content.length > 2000) {
        return HttpResponse.json(
          {
            message: 'Review.content inválido.',
            details: { field: 'content' },
          },
          { status: 422 },
        )
      }

      const duplicated = db.reviews.some(
        (review) =>
          review.userId === payload.userId &&
          review.mediaId === payload.mediaId &&
          !review.isDeleted,
      )

      if (duplicated) {
        return HttpResponse.json(
          {
            message: 'Já existe uma resenha ativa para esta mídia.',
            details: { field: 'mediaId' },
          },
          { status: 409 },
        )
      }

      const review = {
        id: `rv_${db.reviews.length + 1}`,
        ...payload,
        content,
      }
      db.reviews.push(review)

      return HttpResponse.json(review, { status: 201 })
    }),

    http.patch(`${BASE_URL}/reviews/:id`, async ({ request, params }) => {
      const patch = await request.json()
      record(request, patch)

      const review = db.reviews.find((entry) => entry.id === params.id)

      if (!review) {
        return HttpResponse.json(
          { message: 'Recurso não encontrado.' },
          { status: 404 },
        )
      }

      Object.assign(review, patch)
      return HttpResponse.json(review)
    }),

    http.delete(`${BASE_URL}/reviews/:id`, ({ request, params }) => {
      record(request)

      const review = db.reviews.find((entry) => entry.id === params.id)

      if (!review) {
        return HttpResponse.json(
          { message: 'Recurso não encontrado.' },
          { status: 404 },
        )
      }

      db.reviews = db.reviews.filter((entry) => entry.id !== params.id)
      return HttpResponse.json({}, { status: 200 })
    }),
  ]
}

describe('Reviews resource contract (GET/POST/PATCH/DELETE + errors)', () => {
  let db
  let calls
  let resources

  beforeEach(() => {
    db = createDb()
    calls = []
    server.use(...createHandlers(db, calls))
    resources = createJsonServerResources(
      createJsonServerClient({ baseUrl: BASE_URL }),
    )
  })

  function lastCall() {
    return calls[calls.length - 1]
  }

  describe('GET /reviews', () => {
    it('lista apenas resenhas públicas da mídia (isDeleted filtrado na aplicação)', async () => {
      const reviews = await resources.reviews.listByMedia(MEDIA_ID)

      expect(reviews.map((review) => review.id)).toEqual(['rv_1'])
      expect(lastCall()).toMatchObject({
        method: 'GET',
        pathname: '/reviews',
        query: { mediaId: MEDIA_ID },
      })
    })

    it('inclui removidas logicamente com includeDeleted', async () => {
      const reviews = await resources.reviews.listByMedia(MEDIA_ID, {
        includeDeleted: true,
      })

      expect(reviews.map((review) => review.id)).toEqual([
        'rv_1',
        'rv_deleted',
      ])
    })

    it('localiza resenha por usuário+mídia respeitando includeDeleted', async () => {
      await expect(
        resources.reviews.findByUserAndMedia({
          userId: 'u_1',
          mediaId: MEDIA_ID,
          includeDeleted: false,
        }),
      ).resolves.toMatchObject({ id: 'rv_1' })

      await expect(
        resources.reviews.findByUserAndMedia({
          userId: 'u_2',
          mediaId: MEDIA_ID,
          includeDeleted: false,
        }),
      ).resolves.toBeNull()

      await expect(
        resources.reviews.findByUserAndMedia({
          userId: 'u_2',
          mediaId: MEDIA_ID,
        }),
      ).resolves.toMatchObject({ id: 'rv_deleted' })

      expect(lastCall().query).toEqual({
        userId: 'u_2',
        mediaId: MEDIA_ID,
      })
    })

    it('filtra por id para apoiar edição por identificador', async () => {
      const [review] = await resources.reviews.list({ id: 'rv_1' })

      expect(review).toMatchObject({ id: 'rv_1', userId: 'u_1' })
      expect(lastCall().query).toEqual({ id: 'rv_1' })
    })
  })

  describe('POST /reviews', () => {
    it('publica resenha com Content-Type JSON, timestamps e isDeleted=false', async () => {
      const created = await resources.reviews.create({
        userId: 'u_3',
        mediaId: MEDIA_ID,
        content: '  Resenha publicada por novo usuário.  ',
      })

      expect(created).toMatchObject({
        userId: 'u_3',
        mediaId: MEDIA_ID,
        content: 'Resenha publicada por novo usuário.',
        isDeleted: false,
      })

      for (const field of ['createdAt', 'updatedAt', 'publishedAt']) {
        expect(Number.isNaN(Date.parse(created[field]))).toBe(false)
      }

      expect(lastCall()).toMatchObject({
        method: 'POST',
        pathname: '/reviews',
        contentType: 'application/json',
      })
      expect(lastCall().body).toMatchObject({
        userId: 'u_3',
        mediaId: MEDIA_ID,
        content: 'Resenha publicada por novo usuário.',
        isDeleted: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        publishedAt: expect.any(String),
      })
      expect(db.reviews.at(-1)).toMatchObject({ id: 'rv_4', userId: 'u_3' })
    })

    it('normaliza erro 422 de conteúdo inválido', async () => {
      const error = await resources.reviews
        .create({
          userId: 'u_3',
          mediaId: MEDIA_ID,
          content: 'curta',
        })
        .catch((caught) => caught)

      expect(error).toBeInstanceOf(JsonServerClientError)
      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 422,
        retryable: false,
        details: { field: 'content' },
      })
    })

    it('normaliza conflito 409 sem criar duplicata para usuário+mídia', async () => {
      const error = await resources.reviews
        .create({
          userId: 'u_1',
          mediaId: MEDIA_ID,
          content: 'Tentativa duplicada com tamanho válido.',
        })
        .catch((caught) => caught)

      expect(error).toMatchObject({
        code: 'CONFLICT',
        status: 409,
        retryable: false,
      })
      expect(
        db.reviews.filter(
          (review) =>
            review.userId === 'u_1' &&
            review.mediaId === MEDIA_ID &&
            !review.isDeleted,
        ),
      ).toHaveLength(1)
    })
  })

  describe('PATCH /reviews/{id}', () => {
    it('edita conteúdo e renova updatedAt', async () => {
      const updated = await resources.reviews.updateContent({
        id: 'rv_1',
        content: '  Conteúdo editado com novos detalhes.  ',
      })

      expect(updated).toMatchObject({
        id: 'rv_1',
        content: 'Conteúdo editado com novos detalhes.',
      })
      expect(updated.updatedAt).not.toBe(ISO)
      expect(lastCall()).toMatchObject({
        method: 'PATCH',
        pathname: '/reviews/rv_1',
        contentType: 'application/json',
      })
      expect(lastCall().body).toMatchObject({
        content: 'Conteúdo editado com novos detalhes.',
        updatedAt: expect.any(String),
      })
    })

    it('atualiza campos arbitrários com updatedAt padrão', async () => {
      const updated = await resources.reviews.update('rv_1', {
        content: 'Atualização genérica com tamanho suficiente.',
      })

      expect(updated.content).toBe(
        'Atualização genérica com tamanho suficiente.',
      )
      expect(lastCall().body.updatedAt).toEqual(expect.any(String))
    })

    it('normaliza erro 404 para resenha inexistente', async () => {
      await expect(
        resources.reviews.updateContent({
          id: 'rv_missing',
          content: 'Conteúdo válido para resenha inexistente.',
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
        retryable: false,
      })
    })
  })

  describe('DELETE /reviews/{id}', () => {
    it('remove fisicamente quando softDelete=false', async () => {
      await resources.reviews.remove('rv_1', { softDelete: false })

      expect(lastCall()).toMatchObject({
        method: 'DELETE',
        pathname: '/reviews/rv_1',
      })
      expect(db.reviews.find((review) => review.id === 'rv_1')).toBeUndefined()
      await expect(
        resources.reviews.listByMedia(MEDIA_ID),
      ).resolves.toHaveLength(0)
    })

    it('aplica exclusão lógica quando softDelete=true', async () => {
      const result = await resources.reviews.remove('rv_1', {
        softDelete: true,
      })

      expect(result.isDeleted).toBe(true)
      expect(lastCall()).toMatchObject({
        method: 'PATCH',
        pathname: '/reviews/rv_1',
        contentType: 'application/json',
      })
      expect(lastCall().body.isDeleted).toBe(true)
      expect(db.reviews.find((review) => review.id === 'rv_1')).toMatchObject({
        isDeleted: true,
      })
      await expect(
        resources.reviews.listByMedia(MEDIA_ID, { includeDeleted: true }),
      ).resolves.toHaveLength(2)
    })

    it('normaliza erro 404 ao remover resenha inexistente', async () => {
      await expect(
        resources.reviews.remove('rv_missing', { softDelete: false }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
        retryable: false,
      })
    })

    it('aceita resposta 204 No Content sem corpo', async () => {
      server.use(
        http.delete(
          `${BASE_URL}/reviews/:id`,
          () => new HttpResponse(null, { status: 204 }),
        ),
      )

      await expect(resources.reviews.remove('rv_1')).resolves.toBeNull()
    })
  })

  describe('falhas de transporte', () => {
    it('normaliza falha de rede como NETWORK_ERROR retentável', async () => {
      server.use(http.get(`${BASE_URL}/reviews`, () => HttpResponse.error()))

      await expect(
        resources.reviews.listByMedia(MEDIA_ID),
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      })
    })
  })
})

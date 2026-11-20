import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../mocks/server'
import {
  createJsonServerClient,
  JsonServerClientError,
} from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'

const BASE_URL = 'http://localhost:3001'
const MEDIA_ID = 'tt0133093'
const USER_ID = 'u_1'

function createDb() {
  return {
    ratings: [
      {
        id: 'ra_1',
        userId: USER_ID,
        mediaId: MEDIA_ID,
        value: 5,
        createdAt: '2026-11-18T12:20:00.000Z',
        updatedAt: '2026-11-18T12:20:00.000Z',
      },
      {
        id: 'ra_2',
        userId: 'u_2',
        mediaId: 'tt0903747',
        value: 3,
        createdAt: '2026-11-18T12:25:00.000Z',
        updatedAt: '2026-11-18T12:25:00.000Z',
      },
    ],
  }
}

function createHandlers(db) {
  return [
    http.get(`${BASE_URL}/ratings`, ({ request }) => {
      const url = new URL(request.url)
      const mediaId = url.searchParams.get('mediaId')
      const userId = url.searchParams.get('userId')

      const items = db.ratings.filter((rating) => {
        if (mediaId && rating.mediaId !== mediaId) {
          return false
        }
        if (userId && rating.userId !== userId) {
          return false
        }
        return true
      })

      return HttpResponse.json(items)
    }),

    http.post(`${BASE_URL}/ratings`, async ({ request }) => {
      const payload = await request.json()

      if (!Number.isInteger(payload.value) || payload.value < 1 || payload.value > 5) {
        return HttpResponse.json(
          {
            message: 'A nota deve ser um inteiro entre 1 e 5.',
            details: { field: 'value' },
          },
          { status: 422 },
        )
      }

      const duplicate = db.ratings.some(
        (rating) =>
          rating.userId === payload.userId && rating.mediaId === payload.mediaId,
      )

      if (duplicate) {
        return HttpResponse.json(
          {
            message: 'Já existe uma nota ativa para este usuário e mídia.',
            details: { field: 'userId' },
          },
          { status: 409 },
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

      if (!rating) {
        return HttpResponse.json(
          { message: 'Nota não encontrada.' },
          { status: 404 },
        )
      }

      if (
        patch.value !== undefined &&
        (!Number.isInteger(patch.value) || patch.value < 1 || patch.value > 5)
      ) {
        return HttpResponse.json(
          {
            message: 'A nota deve ser um inteiro entre 1 e 5.',
            details: { field: 'value' },
          },
          { status: 422 },
        )
      }

      Object.assign(rating, patch)
      return HttpResponse.json(rating)
    }),
  ]
}

describe('US2 — contrato do recurso ratings', () => {
  let db
  let resources

  beforeEach(() => {
    db = createDb()
    server.use(...createHandlers(db))

    const client = createJsonServerClient({ baseUrl: BASE_URL })
    resources = createJsonServerResources(client)
  })

  it('expõe GET por mídia e por usuário+mídia', async () => {
    const byMedia = await resources.ratings.listByMedia(MEDIA_ID)
    expect(byMedia).toEqual([
      expect.objectContaining({
        id: 'ra_1',
        userId: USER_ID,
        mediaId: MEDIA_ID,
        value: 5,
      }),
    ])

    const byUserAndMedia = await resources.ratings.findByUserAndMedia({
      userId: USER_ID,
      mediaId: MEDIA_ID,
    })
    expect(byUserAndMedia).toMatchObject({
      id: 'ra_1',
      value: 5,
    })

    const missing = await resources.ratings.findByUserAndMedia({
      userId: USER_ID,
      mediaId: 'tt9999999',
    })
    expect(missing).toBeNull()
  })

  it('aceita POST válido com status 201 e timestamps', async () => {
    const created = await resources.ratings.create({
      userId: 'u_3',
      mediaId: MEDIA_ID,
      value: 4,
    })

    expect(created).toMatchObject({
      userId: 'u_3',
      mediaId: MEDIA_ID,
      value: 4,
    })
    expect(created.id).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(Number.isNaN(Date.parse(created.updatedAt))).toBe(false)
    expect(db.ratings).toHaveLength(3)
  })

  it('normaliza 422 para nota fora de 1..5 ou não inteira', async () => {
    await expect(
      resources.ratings.create({
        userId: 'u_3',
        mediaId: MEDIA_ID,
        value: 6,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      retryable: false,
      details: { field: 'value' },
    })

    await expect(
      resources.ratings.create({
        userId: 'u_3',
        mediaId: MEDIA_ID,
        value: 2.5,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      details: { field: 'value' },
    })
  })

  it('normaliza 409 para segunda nota ativa do mesmo usuário+mídia', async () => {
    await expect(
      resources.ratings.create({
        userId: USER_ID,
        mediaId: MEDIA_ID,
        value: 3,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      retryable: false,
    })

    expect(
      db.ratings.filter(
        (rating) => rating.userId === USER_ID && rating.mediaId === MEDIA_ID,
      ),
    ).toHaveLength(1)
  })

  it('aceita PATCH para atualizar a nota ativa sem criar duplicidade', async () => {
    const updated = await resources.ratings.updateValue({ id: 'ra_1', value: 2 })

    expect(updated).toMatchObject({
      id: 'ra_1',
      userId: USER_ID,
      mediaId: MEDIA_ID,
      value: 2,
    })
    expect(Number.isNaN(Date.parse(updated.updatedAt))).toBe(false)

    const active = await resources.ratings.findByUserAndMedia({
      userId: USER_ID,
      mediaId: MEDIA_ID,
    })
    expect(active.value).toBe(2)
    expect(db.ratings).toHaveLength(2)
  })

  it('expõe erros do contrato como JsonServerClientError', async () => {
    server.use(
      http.get(`${BASE_URL}/ratings`, () =>
        HttpResponse.json({ message: 'Serviço indisponível.' }, { status: 503 }),
      ),
    )

    await expect(resources.ratings.listByMedia(MEDIA_ID)).rejects.toBeInstanceOf(
      JsonServerClientError,
    )
    await expect(resources.ratings.listByMedia(MEDIA_ID)).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      status: 503,
      retryable: true,
    })
  })
})

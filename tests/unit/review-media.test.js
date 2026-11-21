import { describe, expect, it, vi } from 'vitest'
import { JsonServerClientError } from '../../src/shared/api/json-server/client'
import {
  REVIEW_MEDIA_ERROR_CODES,
  ReviewMediaError,
  deleteReview,
  editReview,
  getActiveReview,
  listPublicReviews,
  publishReview,
  validateReviewContent,
} from '../../src/features/review-media/model/review-media'

const USER_ID = 'u_1'
const MEDIA_ID = 'tt0133093'
const VALID_CONTENT = 'Resenha original com mais de vinte caracteres.'
const MIN_CONTENT = 'a'.repeat(20)
const MAX_CONTENT = 'b'.repeat(2000)
const PUBLISHED_AT = '2026-11-20T12:00:00.000Z'

function createReview(overrides = {}) {
  return {
    id: 'rv_1',
    userId: USER_ID,
    mediaId: MEDIA_ID,
    content: VALID_CONTENT,
    isDeleted: false,
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    publishedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createFakeResources(initialReviews = []) {
  const reviews = initialReviews.map((review) => ({ ...review }))
  let sequence = 0

  const gateway = {
    async findByUserAndMedia({ userId, mediaId, includeDeleted = true }) {
      const matches = reviews.filter(
        (review) => review.userId === userId && review.mediaId === mediaId,
      )

      if (includeDeleted) {
        return matches[0] ?? null
      }

      return matches.find((review) => !review.isDeleted) ?? null
    },

    list: vi.fn(async (query = {}) =>
      reviews.filter((review) =>
        Object.entries(query).every(([key, value]) => review[key] === value),
      ),
    ),

    listByMedia: vi.fn(async (mediaId) => {
      return reviews.filter((review) => review.mediaId === mediaId)
    }),

    create: vi.fn(async (payload) => {
      sequence += 1
      const review = {
        id: `rv_new_${sequence}`,
        ...payload,
        isDeleted: false,
        createdAt: PUBLISHED_AT,
        updatedAt: PUBLISHED_AT,
        publishedAt: payload.publishedAt ?? PUBLISHED_AT,
      }

      reviews.push(review)
      return review
    }),

    update: vi.fn(async (id, patch) => {
      const index = reviews.findIndex((review) => review.id === id)

      if (index === -1) {
        throw new Error(`Review não encontrada: ${id}`)
      }

      reviews[index] = { ...reviews[index], ...patch }
      return reviews[index]
    }),

    remove: vi.fn(async (id, options = {}) => {
      const index = reviews.findIndex((review) => review.id === id)

      if (index === -1) {
        throw new Error(`Review não encontrada: ${id}`)
      }

      if (options.softDelete) {
        reviews[index] = { ...reviews[index], isDeleted: true }
        return reviews[index]
      }

      reviews.splice(index, 1)
      return null
    }),
  }

  return {
    resources: { reviews: gateway },
    reviews: () => reviews,
  }
}

function expectReviewMediaError(error, code) {
  expect(error).toBeInstanceOf(ReviewMediaError)
  expect(error.code).toBe(code)
}

describe('validateReviewContent', () => {
  it('aceita exatamente os limites mínimo e máximo após trim', () => {
    expect(validateReviewContent(MIN_CONTENT)).toMatchObject({
      valid: true,
      value: MIN_CONTENT,
    })
    expect(validateReviewContent(`  ${MAX_CONTENT}  `)).toMatchObject({
      valid: true,
      value: MAX_CONTENT,
    })
  })

  it('rejeita conteúdo vazio, somente espaços e fora dos limites', () => {
    for (const content of ['', '   ', 'a'.repeat(19), 'b'.repeat(2001), null, 42]) {
      const result = validateReviewContent(content)

      expect(result.valid).toBe(false)
      expect(result.value).toBeNull()
      expect(result.errors[0].field).toBe('content')
    }
  })
})

describe('publishReview', () => {
  it('cria a resenha quando não existe registro ativo', async () => {
    const { resources, reviews } = createFakeResources()

    const result = await publishReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: `  ${VALID_CONTENT}  `,
      publishedAt: PUBLISHED_AT,
      resources,
    })

    expect(result).toMatchObject({
      created: true,
      updated: false,
      restored: false,
    })
    expect(result.reviewId).toBe('rv_new_1')
    expect(resources.reviews.create).toHaveBeenCalledTimes(1)
    expect(reviews()).toHaveLength(1)
    expect(reviews()[0]).toMatchObject({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: VALID_CONTENT,
      isDeleted: false,
      publishedAt: PUBLISHED_AT,
      updatedAt: PUBLISHED_AT,
    })
  })

  it('atualiza a resenha ativa em vez de criar duplicata (userId + mediaId)', async () => {
    const { resources, reviews } = createFakeResources([createReview()])

    const result = await publishReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: 'Conteúdo atualizado com mais de vinte caracteres.',
      publishedAt: PUBLISHED_AT,
      resources,
    })

    expect(result).toMatchObject({
      created: false,
      updated: true,
      restored: false,
      reviewId: 'rv_1',
    })
    expect(resources.reviews.create).not.toHaveBeenCalled()
    expect(reviews()).toHaveLength(1)
    expect(reviews()[0]).toMatchObject({
      id: 'rv_1',
      content: 'Conteúdo atualizado com mais de vinte caracteres.',
      publishedAt: '2026-11-18T12:00:00.000Z',
      updatedAt: PUBLISHED_AT,
    })
  })

  it('reaproveita resenha removida logicamente em vez de duplicar', async () => {
    const { resources, reviews } = createFakeResources([
      createReview({ isDeleted: true }),
    ])

    const result = await publishReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: 'Republicando uma resenha com novo conteúdo válido.',
      publishedAt: PUBLISHED_AT,
      resources,
    })

    expect(result).toMatchObject({
      created: false,
      updated: false,
      restored: true,
      reviewId: 'rv_1',
    })
    expect(resources.reviews.create).not.toHaveBeenCalled()
    expect(reviews()).toHaveLength(1)
    expect(reviews()[0]).toMatchObject({
      isDeleted: false,
      publishedAt: PUBLISHED_AT,
      updatedAt: PUBLISHED_AT,
    })
  })

  it('bloqueia conteúdo inválido antes de chamar a API', async () => {
    const { resources } = createFakeResources()

    const error = await publishReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: 'curta',
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.VALIDATION_ERROR)
    expect(error.details.field).toBe('content')
    expect(resources.reviews.create).not.toHaveBeenCalled()
  })

  it('resolve conflito de publicação concorrente atualizando a resenha ativa', async () => {
    const { resources, reviews } = createFakeResources([
      createReview({ id: 'rv_race' }),
    ])

    resources.reviews.findByUserAndMedia = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createReview({ id: 'rv_race' }))
    resources.reviews.create = vi.fn().mockRejectedValue(
      new JsonServerClientError({
        code: 'CONFLICT',
        message: 'Conflito de dados detectado.',
        status: 409,
      }),
    )

    const result = await publishReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: VALID_CONTENT,
      publishedAt: PUBLISHED_AT,
      resources,
    })

    expect(result).toMatchObject({
      created: false,
      updated: true,
      reviewId: 'rv_race',
    })
    expect(reviews()).toHaveLength(1)
  })

  it('propaga conflito não resolvido como erro de domínio', async () => {
    const { resources } = createFakeResources()

    resources.reviews.findByUserAndMedia = vi.fn().mockResolvedValue(null)
    resources.reviews.create = vi.fn().mockRejectedValue(
      new JsonServerClientError({
        code: 'CONFLICT',
        message: 'Conflito de dados detectado.',
        status: 409,
      }),
    )

    const error = await publishReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: VALID_CONTENT,
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.CONFLICT)
  })
})

describe('editReview', () => {
  it('edita a resenha ativa do próprio usuário pela chave natural', async () => {
    const { resources, reviews } = createFakeResources([createReview()])

    const result = await editReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: 'Conteúdo editado com mais de vinte caracteres.',
      updatedAt: PUBLISHED_AT,
      resources,
    })

    expect(result.reviewId).toBe('rv_1')
    expect(resources.reviews.create).not.toHaveBeenCalled()
    expect(reviews()[0]).toMatchObject({
      content: 'Conteúdo editado com mais de vinte caracteres.',
      publishedAt: '2026-11-18T12:00:00.000Z',
      updatedAt: PUBLISHED_AT,
    })
  })

  it('edita a resenha pelo id informado', async () => {
    const { resources } = createFakeResources([createReview()])

    const result = await editReview({
      reviewId: 'rv_1',
      userId: USER_ID,
      content: 'Outro conteúdo editado com vinte ou mais caracteres.',
      updatedAt: PUBLISHED_AT,
      resources,
    })

    expect(result.review.content).toBe(
      'Outro conteúdo editado com vinte ou mais caracteres.',
    )
    expect(resources.reviews.list).toHaveBeenCalledWith({ id: 'rv_1' })
  })

  it('impede edição de resenha de outro autor', async () => {
    const { resources } = createFakeResources([
      createReview({ id: 'rv_2', userId: 'u_2' }),
    ])

    const error = await editReview({
      reviewId: 'rv_2',
      userId: USER_ID,
      content: VALID_CONTENT,
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.FORBIDDEN)
    expect(resources.reviews.update).not.toHaveBeenCalled()
  })

  it('retorna NOT_FOUND quando não há resenha ativa', async () => {
    const { resources } = createFakeResources([createReview({ isDeleted: true })])

    const error = await editReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: VALID_CONTENT,
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.NOT_FOUND)
  })

  it('valida o conteúdo antes de editar', async () => {
    const { resources } = createFakeResources([createReview()])

    const error = await editReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: 'curta',
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.VALIDATION_ERROR)
    expect(resources.reviews.update).not.toHaveBeenCalled()
  })
})

describe('deleteReview', () => {
  it('remove logicamente a resenha ativa do próprio usuário', async () => {
    const { resources, reviews } = createFakeResources([createReview()])

    const result = await deleteReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      resources,
    })

    expect(result).toEqual({ deleted: true, id: 'rv_1', softDeleted: true })
    expect(resources.reviews.remove).toHaveBeenCalledWith('rv_1', {
      softDelete: true,
    })
    expect(reviews()[0].isDeleted).toBe(true)
  })

  it('suporta remoção física quando solicitada', async () => {
    const { resources, reviews } = createFakeResources([createReview()])

    const result = await deleteReview({
      reviewId: 'rv_1',
      userId: USER_ID,
      softDelete: false,
      resources,
    })

    expect(result).toEqual({ deleted: true, id: 'rv_1', softDeleted: false })
    expect(reviews()).toHaveLength(0)
  })

  it('impede exclusão de resenha de outro autor', async () => {
    const { resources } = createFakeResources([
      createReview({ id: 'rv_2', userId: 'u_2' }),
    ])

    const error = await deleteReview({
      reviewId: 'rv_2',
      userId: USER_ID,
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.FORBIDDEN)
    expect(resources.reviews.remove).not.toHaveBeenCalled()
  })

  it('retorna NOT_FOUND quando não há resenha ativa', async () => {
    const { resources } = createFakeResources()

    const error = await deleteReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      resources,
    }).catch((caught) => caught)

    expectReviewMediaError(error, REVIEW_MEDIA_ERROR_CODES.NOT_FOUND)
    expect(resources.reviews.remove).not.toHaveBeenCalled()
  })
})

describe('getActiveReview', () => {
  it('retorna apenas a resenha ativa do usuário para a mídia', async () => {
    const { resources } = createFakeResources([
      createReview({ id: 'rv_deleted', isDeleted: true }),
      createReview({ id: 'rv_active' }),
    ])

    const review = await getActiveReview({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      resources,
    })

    expect(review?.id).toBe('rv_active')
  })
})

describe('listPublicReviews', () => {
  it('lista as resenhas publicadas ignorando registros removidos', async () => {
    const { resources } = createFakeResources([
      createReview({ id: 'rv_active' }),
      createReview({ id: 'rv_deleted', userId: 'u_2', isDeleted: true }),
    ])

    const reviews = await listPublicReviews({ mediaId: MEDIA_ID, resources })

    expect(reviews.map((review) => review.id)).toEqual(['rv_active'])
    expect(resources.reviews.listByMedia).toHaveBeenCalledWith(MEDIA_ID)
  })
})

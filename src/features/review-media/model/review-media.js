import { REVIEW_CONSTRAINTS } from '../../../entities/review/model/review.schema'
import { JsonServerClientError } from '../../../shared/api/json-server/client'
import { jsonServerResources } from '../../../shared/api/json-server/resources'

export const REVIEW_MEDIA_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
})

/**
 * Erro de domínio do ciclo de vida de resenhas. Mantém o mesmo formato usado
 * pelo cliente do JSON Server (code/message/details) para facilitar o
 * tratamento na UI.
 */
export class ReviewMediaError extends Error {
  constructor({ code, message, details = null, cause = null }) {
    super(message)
    this.name = 'ReviewMediaError'
    this.code = code
    this.details = details
    this.cause = cause
  }
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo obrigatório inválido: ${fieldName}`)
  }

  return value.trim()
}

function resolveTimestamp(value, fieldName) {
  if (value === undefined || value === null) {
    return new Date().toISOString()
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`Data inválida: ${fieldName}`)
  }

  return new Date(value).toISOString()
}

function notFoundError() {
  return new ReviewMediaError({
    code: REVIEW_MEDIA_ERROR_CODES.NOT_FOUND,
    message: 'Resenha ativa não encontrada para esta mídia.',
    details: { field: 'reviewId' },
  })
}

/**
 * Review.content (data-model.md): 20-2000 caracteres após trim().
 * Textos vazios ou somente com espaços são rejeitados.
 */
export function validateReviewContent(content) {
  const normalized = typeof content === 'string' ? content.trim() : ''
  const errors = []

  if (!normalized) {
    errors.push({
      field: 'content',
      message: 'Escreva uma resenha antes de publicar.',
    })
  } else if (normalized.length < REVIEW_CONSTRAINTS.minLength) {
    errors.push({
      field: 'content',
      message: `A resenha deve ter pelo menos ${REVIEW_CONSTRAINTS.minLength} caracteres.`,
    })
  } else if (normalized.length > REVIEW_CONSTRAINTS.maxLength) {
    errors.push({
      field: 'content',
      message: `A resenha deve ter no máximo ${REVIEW_CONSTRAINTS.maxLength} caracteres.`,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? normalized : null,
  }
}

export function assertValidReviewContent(content) {
  const result = validateReviewContent(content)

  if (!result.valid) {
    throw new ReviewMediaError({
      code: REVIEW_MEDIA_ERROR_CODES.VALIDATION_ERROR,
      message: result.errors[0]?.message ?? 'Resenha inválida.',
      details: result.errors[0],
    })
  }

  return result.value
}

async function findActiveReview({ resources, userId, mediaId }) {
  return resources.reviews.findByUserAndMedia({
    userId,
    mediaId,
    includeDeleted: false,
  })
}

async function findAnyReview({ resources, userId, mediaId }) {
  return resources.reviews.findByUserAndMedia({
    userId,
    mediaId,
    includeDeleted: true,
  })
}

/**
 * Localiza a resenha alvo de edição/exclusão por id ou pela chave natural
 * (userId + mediaId). Apenas a resenha ativa é considerada quando a busca é
 * feita pela chave natural.
 */
async function resolveReviewForMutation({
  resources,
  reviewId,
  userId,
  mediaId,
}) {
  if (reviewId !== undefined && reviewId !== null && reviewId !== '') {
    const normalizedId = normalizeRequiredString(reviewId, 'reviewId')
    const reviews = await resources.reviews.list({ id: normalizedId })
    const matches = Array.isArray(reviews) ? reviews : []

    return matches.find((review) => review?.id === normalizedId) ?? null
  }

  return findActiveReview({
    resources,
    userId: normalizeRequiredString(userId, 'userId'),
    mediaId: normalizeRequiredString(mediaId, 'mediaId'),
  })
}

function assertReviewOwnership(review, userId) {
  if (review?.userId !== userId) {
    throw new ReviewMediaError({
      code: REVIEW_MEDIA_ERROR_CODES.FORBIDDEN,
      message: 'Você só pode alterar resenhas de sua autoria.',
      details: { field: 'userId' },
    })
  }
}

/**
 * Publica uma resenha aplicando a regra de uma resenha ativa por
 * (userId, mediaId) — data-model.md (Review.userId + Review.mediaId).
 *
 * - Sem resenha ativa: cria o registro com publishedAt/updatedAt.
 * - Com resenha ativa: atualiza o conteúdo existente, preservando publishedAt
 *   e renovando Review.updatedAt.
 * - Com resenha removida logicamente: reaproveita o registro, republicando-o
 *   em vez de criar uma duplicata (Review.isDeleted = false).
 */
export async function publishReview({
  userId,
  mediaId,
  content,
  publishedAt,
  resources = jsonServerResources,
} = {}) {
  const normalizedUserId = normalizeRequiredString(userId, 'userId')
  const normalizedMediaId = normalizeRequiredString(mediaId, 'mediaId')
  const normalizedContent = assertValidReviewContent(content)
  const timestamp = resolveTimestamp(publishedAt, 'publishedAt')

  const activeReview = await findActiveReview({
    resources,
    userId: normalizedUserId,
    mediaId: normalizedMediaId,
  })

  if (activeReview) {
    const review = await resources.reviews.update(activeReview.id, {
      content: normalizedContent,
      updatedAt: timestamp,
    })

    return {
      created: false,
      updated: true,
      restored: false,
      reviewId: activeReview.id,
      review,
    }
  }

  const existingReview = await findAnyReview({
    resources,
    userId: normalizedUserId,
    mediaId: normalizedMediaId,
  })

  if (existingReview) {
    const review = await resources.reviews.update(existingReview.id, {
      content: normalizedContent,
      isDeleted: false,
      updatedAt: timestamp,
      publishedAt: timestamp,
    })

    return {
      created: false,
      updated: false,
      restored: true,
      reviewId: existingReview.id,
      review,
    }
  }

  try {
    const review = await resources.reviews.create({
      userId: normalizedUserId,
      mediaId: normalizedMediaId,
      content: normalizedContent,
      publishedAt: timestamp,
    })

    return {
      created: true,
      updated: false,
      restored: false,
      reviewId: review?.id ?? null,
      review,
    }
  } catch (error) {
    // Duas publicações concorrentes: reaplica o conteúdo na resenha ativa
    // criada pela outra requisição para manter a unicidade por usuário+mídia.
    if (error instanceof JsonServerClientError && error.code === 'CONFLICT') {
      const conflictingReview = await findActiveReview({
        resources,
        userId: normalizedUserId,
        mediaId: normalizedMediaId,
      })

      if (conflictingReview) {
        const review = await resources.reviews.update(conflictingReview.id, {
          content: normalizedContent,
          updatedAt: timestamp,
        })

        return {
          created: false,
          updated: true,
          restored: false,
          reviewId: conflictingReview.id,
          review,
        }
      }

      throw new ReviewMediaError({
        code: REVIEW_MEDIA_ERROR_CODES.CONFLICT,
        message: 'Já existe uma resenha ativa para esta mídia.',
        details: { field: 'mediaId' },
        cause: error,
      })
    }

    throw error
  }
}

/**
 * Edita a resenha ativa de autoria do próprio usuário (FR-008).
 * Aceita a resenha por id ou pela chave (userId, mediaId); o conteúdo anterior
 * é substituído e Review.updatedAt é renovado, preservando publishedAt.
 */
export async function editReview({
  reviewId,
  userId,
  mediaId,
  content,
  updatedAt,
  resources = jsonServerResources,
} = {}) {
  const normalizedUserId = normalizeRequiredString(userId, 'userId')
  const normalizedContent = assertValidReviewContent(content)
  const timestamp = resolveTimestamp(updatedAt, 'updatedAt')

  const review = await resolveReviewForMutation({
    resources,
    reviewId,
    userId: normalizedUserId,
    mediaId,
  })

  if (!review || review.isDeleted) {
    throw notFoundError()
  }

  assertReviewOwnership(review, normalizedUserId)

  const updated = await resources.reviews.update(review.id, {
    content: normalizedContent,
    updatedAt: timestamp,
  })

  return {
    review: updated,
    reviewId: review.id,
  }
}

/**
 * Remove a resenha ativa do próprio usuário (FR-008). Usa exclusão lógica por
 * padrão (Review.isDeleted = true) para preservar auditoria local; a remoção
 * física pode ser solicitada com `softDelete: false`.
 */
export async function deleteReview({
  reviewId,
  userId,
  mediaId,
  softDelete = true,
  resources = jsonServerResources,
} = {}) {
  const normalizedUserId = normalizeRequiredString(userId, 'userId')

  const review = await resolveReviewForMutation({
    resources,
    reviewId,
    userId: normalizedUserId,
    mediaId,
  })

  if (!review || review.isDeleted) {
    throw notFoundError()
  }

  assertReviewOwnership(review, normalizedUserId)

  const useSoftDelete = Boolean(softDelete)

  await resources.reviews.remove(review.id, { softDelete: useSoftDelete })

  return {
    deleted: true,
    id: review.id,
    softDeleted: useSoftDelete,
  }
}

/**
 * Retorna a resenha ativa do usuário para a mídia (ou null).
 */
export async function getActiveReview({
  userId,
  mediaId,
  resources = jsonServerResources,
} = {}) {
  return findActiveReview({
    resources,
    userId: normalizeRequiredString(userId, 'userId'),
    mediaId: normalizeRequiredString(mediaId, 'mediaId'),
  })
}

/**
 * Lista as resenhas públicas da mídia, ignorando registros removidos
 * logicamente — data-model.md (Review.isDeleted), FR-013.
 */
export async function listPublicReviews({
  mediaId,
  resources = jsonServerResources,
} = {}) {
  const reviews = await resources.reviews.listByMedia(
    normalizeRequiredString(mediaId, 'mediaId'),
  )

  if (!Array.isArray(reviews)) {
    return []
  }

  return reviews.filter((review) => !review?.isDeleted)
}

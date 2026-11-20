import { RATING_CONSTRAINTS } from '../../../entities/rating/model/rating.schema'
import { JsonServerClientError } from '../../../shared/api/json-server/client'
import { jsonServerResources } from '../../../shared/api/json-server/resources'

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo obrigatório inválido: ${fieldName}`)
  }

  return value.trim()
}

export class RateMediaError extends Error {
  constructor({ code, message, field }) {
    super(message)
    this.name = 'RateMediaError'
    this.code = code
    this.field = field ?? null
    this.details = this.field ? { field: this.field } : null
    this.retryable = false
  }
}

/**
 * data-model.md (Rating.value): a nota é um inteiro de 1 a 5.
 */
export function normalizeRatingValue(value) {
  const numeric = Number(value)

  if (
    !Number.isInteger(numeric) ||
    numeric < RATING_CONSTRAINTS.min ||
    numeric > RATING_CONSTRAINTS.max
  ) {
    throw new RateMediaError({
      code: 'VALIDATION_ERROR',
      message: `A nota deve ser um inteiro entre ${RATING_CONSTRAINTS.min} e ${RATING_CONSTRAINTS.max}.`,
      field: 'value',
    })
  }

  return numeric
}

async function updateExistingRating(resources, existing, value) {
  // data-model.md (Rating.updatedAt): a edição substitui o valor e atualiza o timestamp.
  const rating = await resources.ratings.updateValue({ id: existing.id, value })

  return {
    created: false,
    updated: true,
    value,
    rating,
  }
}

/**
 * data-model.md (Rating.userId), data-model.md (Rating.mediaId):
 * a nota é identificada pelo par usuário+mídia.
 * data-model.md (Rating.userId + Rating.mediaId): apenas uma nota ativa por par.
 */
export async function rateMedia({
  userId,
  mediaId,
  value,
  resources = jsonServerResources,
} = {}) {
  const normalizedUserId = normalizeRequiredString(userId, 'userId')
  const normalizedMediaId = normalizeRequiredString(mediaId, 'mediaId')
  const normalizedValue = normalizeRatingValue(value)

  const existing = await resources.ratings.findByUserAndMedia({
    userId: normalizedUserId,
    mediaId: normalizedMediaId,
  })

  if (existing) {
    return updateExistingRating(resources, existing, normalizedValue)
  }

  try {
    const rating = await resources.ratings.create({
      userId: normalizedUserId,
      mediaId: normalizedMediaId,
      value: normalizedValue,
    })

    return {
      created: true,
      updated: false,
      value: normalizedValue,
      rating,
    }
  } catch (error) {
    // Concorrência: outra requisição pode ter criado a nota entre a leitura e o POST.
    if (error instanceof JsonServerClientError && error.code === 'CONFLICT') {
      const conflicting = await resources.ratings.findByUserAndMedia({
        userId: normalizedUserId,
        mediaId: normalizedMediaId,
      })

      if (conflicting) {
        return updateExistingRating(resources, conflicting, normalizedValue)
      }
    }

    throw error
  }
}

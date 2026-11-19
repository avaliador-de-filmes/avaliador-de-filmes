export const RATING_CONSTRAINTS = Object.freeze({
  min: 1,
  max: 5,
})

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function addError(errors, field, message) {
  errors.push({ field, message })
}

export function buildRatingUniqueKey(item) {
  const userId = normalizeString(item?.userId)
  const mediaId = normalizeString(item?.mediaId)
  return `${userId}::${mediaId}`
}

export function validateRatingSchema(payload) {
  const errors = []
  const id = normalizeString(payload?.id)
  const userId = normalizeString(payload?.userId)
  const mediaId = normalizeString(payload?.mediaId)
  const value = Number(payload?.value)
  const createdAt = payload?.createdAt
  const updatedAt = payload?.updatedAt

  if (!id) {
    addError(errors, 'id', 'Rating.id é obrigatório.')
  }

  if (!userId) {
    addError(errors, 'userId', 'Rating.userId é obrigatório.')
  }

  if (!mediaId) {
    addError(errors, 'mediaId', 'Rating.mediaId é obrigatório.')
  }

  if (
    !Number.isInteger(value) ||
    value < RATING_CONSTRAINTS.min ||
    value > RATING_CONSTRAINTS.max
  ) {
    addError(
      errors,
      'value',
      `Rating.value deve ser inteiro entre ${RATING_CONSTRAINTS.min} e ${RATING_CONSTRAINTS.max}.`,
    )
  }

  if (!isIsoDateString(createdAt)) {
    addError(errors, 'createdAt', 'Rating.createdAt deve estar em ISO-8601.')
  }

  if (!isIsoDateString(updatedAt)) {
    addError(errors, 'updatedAt', 'Rating.updatedAt deve estar em ISO-8601.')
  }

  const valueNormalized = errors.length
    ? null
    : {
        id,
        userId,
        mediaId,
        value,
        createdAt,
        updatedAt,
      }

  return {
    valid: errors.length === 0,
    errors,
    value: valueNormalized,
  }
}

export function assertRatingSchema(payload) {
  const result = validateRatingSchema(payload)

  if (!result.valid) {
    throw new TypeError(result.errors[0]?.message ?? 'Rating inválido.')
  }

  return result.value
}

export function validateRatingUniqueness(items = []) {
  const seen = new Set()
  const duplicatedKeys = new Set()

  for (const item of items) {
    const key = buildRatingUniqueKey(item)
    if (key === '::') {
      continue
    }

    if (seen.has(key)) {
      duplicatedKeys.add(key)
      continue
    }

    seen.add(key)
  }

  return {
    valid: duplicatedKeys.size === 0,
    duplicatedKeys: Array.from(duplicatedKeys),
  }
}

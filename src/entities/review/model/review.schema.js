export const REVIEW_CONSTRAINTS = Object.freeze({
  minLength: 20,
  maxLength: 2000,
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

export function buildReviewUniqueKey(item) {
  const userId = normalizeString(item?.userId)
  const mediaId = normalizeString(item?.mediaId)
  return `${userId}::${mediaId}`
}

export function validateReviewSchema(payload) {
  const errors = []
  const id = normalizeString(payload?.id)
  const userId = normalizeString(payload?.userId)
  const mediaId = normalizeString(payload?.mediaId)
  const content = typeof payload?.content === 'string' ? payload.content : ''
  const trimmedContent = content.trim()
  const isDeleted = payload?.isDeleted
  const createdAt = payload?.createdAt
  const updatedAt = payload?.updatedAt
  const publishedAt = payload?.publishedAt

  if (!id) {
    addError(errors, 'id', 'Review.id é obrigatório.')
  }

  if (!userId) {
    addError(errors, 'userId', 'Review.userId é obrigatório.')
  }

  if (!mediaId) {
    addError(errors, 'mediaId', 'Review.mediaId é obrigatório.')
  }

  if (
    !trimmedContent ||
    trimmedContent.length < REVIEW_CONSTRAINTS.minLength ||
    trimmedContent.length > REVIEW_CONSTRAINTS.maxLength
  ) {
    addError(
      errors,
      'content',
      `Review.content deve ter entre ${REVIEW_CONSTRAINTS.minLength} e ${REVIEW_CONSTRAINTS.maxLength} caracteres após trim().`,
    )
  }

  if (typeof isDeleted !== 'boolean') {
    addError(errors, 'isDeleted', 'Review.isDeleted deve ser boolean.')
  }

  if (!isIsoDateString(createdAt)) {
    addError(errors, 'createdAt', 'Review.createdAt deve estar em ISO-8601.')
  }

  if (!isIsoDateString(updatedAt)) {
    addError(errors, 'updatedAt', 'Review.updatedAt deve estar em ISO-8601.')
  }

  if (!isIsoDateString(publishedAt)) {
    addError(errors, 'publishedAt', 'Review.publishedAt deve estar em ISO-8601.')
  }

  const value = errors.length
    ? null
    : {
        id,
        userId,
        mediaId,
        content: trimmedContent,
        isDeleted,
        createdAt,
        updatedAt,
        publishedAt,
      }

  return {
    valid: errors.length === 0,
    errors,
    value,
  }
}

export function assertReviewSchema(payload) {
  const result = validateReviewSchema(payload)

  if (!result.valid) {
    throw new TypeError(result.errors[0]?.message ?? 'Review inválida.')
  }

  return result.value
}

export function validateReviewUniqueness(items = []) {
  const activeKeys = new Set()
  const duplicatedActiveKeys = new Set()

  for (const item of items) {
    if (item?.isDeleted === true) {
      continue
    }

    const key = buildReviewUniqueKey(item)
    if (key === '::') {
      continue
    }

    if (activeKeys.has(key)) {
      duplicatedActiveKeys.add(key)
      continue
    }

    activeKeys.add(key)
  }

  return {
    valid: duplicatedActiveKeys.size === 0,
    duplicatedKeys: Array.from(duplicatedActiveKeys),
  }
}

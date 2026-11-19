import { RATING_CONSTRAINTS } from './rating.schema'

function normalizeMediaId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toValidRatingValue(value) {
  const numeric = Number(value)

  if (
    !Number.isInteger(numeric) ||
    numeric < RATING_CONSTRAINTS.min ||
    numeric > RATING_CONSTRAINTS.max
  ) {
    return null
  }

  return numeric
}

function round(value, precision = 2) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function calculateMediaRatingSummary(mediaId, ratings = []) {
  const normalizedMediaId = normalizeMediaId(mediaId)

  if (!normalizedMediaId) {
    return {
      mediaId: '',
      averageRating: 0,
      ratingsCount: 0,
    }
  }

  const values = ratings
    .filter((rating) => normalizeMediaId(rating?.mediaId) === normalizedMediaId)
    .map((rating) => toValidRatingValue(rating?.value))
    .filter((value) => value !== null)

  const ratingsCount = values.length
  const total = values.reduce((sum, value) => sum + value, 0)
  const averageRating = ratingsCount > 0 ? round(total / ratingsCount, 2) : 0

  return {
    mediaId: normalizedMediaId,
    averageRating,
    ratingsCount,
  }
}

export function calculateMediaRatingSummaries(ratings = []) {
  const byMediaId = new Map()

  for (const rating of ratings) {
    const mediaId = normalizeMediaId(rating?.mediaId)
    const value = toValidRatingValue(rating?.value)

    if (!mediaId || value === null) {
      continue
    }

    if (!byMediaId.has(mediaId)) {
      byMediaId.set(mediaId, [])
    }

    byMediaId.get(mediaId).push(value)
  }

  return Array.from(byMediaId.entries()).map(([mediaId, values]) => {
    const ratingsCount = values.length
    const total = values.reduce((sum, value) => sum + value, 0)

    return {
      mediaId,
      averageRating: ratingsCount > 0 ? round(total / ratingsCount, 2) : 0,
      ratingsCount,
    }
  })
}

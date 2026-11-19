export const MEDIA_TYPES = Object.freeze({
  movie: 'movie',
  series: 'series',
})

export const MEDIA_CONSTRAINTS = Object.freeze({
  titleMin: 1,
  titleMax: 200,
  imdbRatingMin: 0,
  imdbRatingMax: 10,
})

const MEDIA_YEAR_PATTERN = /^\d{4}([–-]\d{4})?$/
const MEDIA_ID_PATTERN = /^tt\d+$/

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isValidUrl(value) {
  if (typeof value !== 'string') {
    return false
  }

  try {
    // eslint-disable-next-line no-new
    new URL(value)
    return true
  } catch {
    return false
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function addError(errors, field, message) {
  errors.push({ field, message })
}

function normalizeGenres(genres) {
  if (!Array.isArray(genres)) {
    return []
  }

  return genres
    .map((genre) => normalizeString(genre))
    .filter(Boolean)
}

export function validateMediaSchema(payload) {
  const errors = []
  const id = normalizeString(payload?.id)
  const type = normalizeString(payload?.type).toLowerCase()
  const title = normalizeString(payload?.title)
  const year = normalizeString(payload?.year)
  const posterUrl = payload?.posterUrl ?? null
  const plot = payload?.plot ?? null
  const genres = normalizeGenres(payload?.genres)
  const imdbRating = payload?.imdbRating ?? null
  const updatedAt = payload?.updatedAt

  if (!id || !MEDIA_ID_PATTERN.test(id)) {
    addError(errors, 'id', 'Media.id deve seguir formato imdbID (ex.: tt0133093).')
  }

  if (type !== MEDIA_TYPES.movie && type !== MEDIA_TYPES.series) {
    addError(errors, 'type', 'Media.type deve ser "movie" ou "series".')
  }

  if (
    !title ||
    title.length < MEDIA_CONSTRAINTS.titleMin ||
    title.length > MEDIA_CONSTRAINTS.titleMax
  ) {
    addError(
      errors,
      'title',
      `Media.title deve ter entre ${MEDIA_CONSTRAINTS.titleMin} e ${MEDIA_CONSTRAINTS.titleMax} caracteres.`,
    )
  }

  if (!year || !MEDIA_YEAR_PATTERN.test(year)) {
    addError(errors, 'year', 'Media.year deve estar no formato OMDb (1999 ou 2018–2020).')
  }

  if (posterUrl !== null && !isValidUrl(posterUrl)) {
    addError(errors, 'posterUrl', 'Media.posterUrl deve ser URL válida ou null.')
  }

  if (plot !== null && typeof plot !== 'string') {
    addError(errors, 'plot', 'Media.plot deve ser string ou null.')
  }

  if (payload?.genres !== undefined && !Array.isArray(payload?.genres)) {
    addError(errors, 'genres', 'Media.genres deve ser um array de strings.')
  }

  if (imdbRating !== null) {
    const numericRating = Number(imdbRating)
    if (
      !Number.isFinite(numericRating) ||
      numericRating < MEDIA_CONSTRAINTS.imdbRatingMin ||
      numericRating > MEDIA_CONSTRAINTS.imdbRatingMax
    ) {
      addError(
        errors,
        'imdbRating',
        `Media.imdbRating deve estar entre ${MEDIA_CONSTRAINTS.imdbRatingMin} e ${MEDIA_CONSTRAINTS.imdbRatingMax} ou null.`,
      )
    }
  }

  if (!isIsoDateString(updatedAt)) {
    addError(errors, 'updatedAt', 'Media.updatedAt deve estar em formato ISO-8601.')
  }

  const value = errors.length
    ? null
    : {
        id,
        type,
        title,
        year,
        posterUrl: posterUrl === null ? null : String(posterUrl),
        plot: plot === null ? null : String(plot),
        genres,
        imdbRating: imdbRating === null ? null : Number(imdbRating),
        updatedAt,
      }

  return {
    valid: errors.length === 0,
    errors,
    value,
  }
}

export function assertMediaSchema(payload) {
  const result = validateMediaSchema(payload)

  if (!result.valid) {
    throw new TypeError(result.errors[0]?.message ?? 'Media inválida.')
  }

  return result.value
}

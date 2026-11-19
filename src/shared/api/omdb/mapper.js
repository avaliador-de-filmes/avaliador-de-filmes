const OMDB_NOT_AVAILABLE = 'N/A'

function isNotAvailable(value) {
  return typeof value === 'string' && value.trim().toUpperCase() === OMDB_NOT_AVAILABLE
}

function toRequiredString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`Campo OMDb inválido: ${fieldName}`)
  }

  const normalized = value.trim()

  if (!normalized || isNotAvailable(normalized)) {
    throw new Error(`Campo OMDb ausente: ${fieldName}`)
  }

  return normalized
}

function toOptionalString(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (!normalized || isNotAvailable(normalized)) {
    return null
  }

  return normalized
}

function toMediaType(value) {
  const normalized = toRequiredString(value, 'Type').toLowerCase()

  if (normalized !== 'movie' && normalized !== 'series') {
    throw new Error('Tipo de mídia inválido recebido da OMDb')
  }

  return normalized
}

function toPosterUrl(value) {
  return toOptionalString(value)
}

function toGenres(value) {
  const genresRaw = toOptionalString(value)

  if (!genresRaw) {
    return []
  }

  return genresRaw
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean)
}

function toImdbRating(value) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string' || isNotAvailable(value)) {
    return null
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toUpdatedAt(value) {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  return new Date().toISOString()
}

function toBaseMedia(payload, updatedAt) {
  return {
    id: toRequiredString(payload?.imdbID, 'imdbID'),
    type: toMediaType(payload?.Type),
    title: toRequiredString(payload?.Title, 'Title'),
    year: toRequiredString(payload?.Year, 'Year'),
    posterUrl: toPosterUrl(payload?.Poster),
    updatedAt: toUpdatedAt(updatedAt),
  }
}

export function mapOmdbSearchItemToMedia(payload, options = {}) {
  const media = toBaseMedia(payload, options.updatedAt)

  return {
    ...media,
    plot: null,
    genres: [],
    imdbRating: null,
  }
}

export function mapOmdbSearchResponse(payload, options = {}) {
  const source = Array.isArray(payload?.Search) ? payload.Search : []
  const totalRaw = payload?.totalResults
  const totalResults =
    typeof totalRaw === 'number'
      ? totalRaw
      : Number.parseInt(typeof totalRaw === 'string' ? totalRaw : '0', 10)

  const items = []

  for (const item of source) {
    try {
      items.push(mapOmdbSearchItemToMedia(item, options))
    } catch {
      // Ignora itens inválidos e mantém os válidos.
    }
  }

  return {
    items,
    totalResults: Number.isFinite(totalResults) ? totalResults : 0,
  }
}

export function mapOmdbDetailResponseToMedia(payload, options = {}) {
  const media = toBaseMedia(payload, options.updatedAt)

  return {
    ...media,
    plot: toOptionalString(payload?.Plot),
    genres: toGenres(payload?.Genre),
    imdbRating: toImdbRating(payload?.imdbRating),
  }
}

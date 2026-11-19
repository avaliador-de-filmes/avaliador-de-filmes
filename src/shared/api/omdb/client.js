import {
  mapOmdbDetailResponseToMedia,
  mapOmdbSearchResponse,
} from './mapper'

const DEFAULT_BASE_URL = 'https://www.omdbapi.com/'

function getEnv() {
  if (typeof import.meta === 'undefined') {
    return {}
  }

  return import.meta.env ?? {}
}

export class OmdbClientError extends Error {
  constructor({ kind, message, retryable, status }) {
    super(message)
    this.name = 'OmdbClientError'
    this.kind = kind
    this.retryable = retryable
    this.status = status ?? null
  }
}

function createOmdbError(kind, message, retryable, status) {
  return new OmdbClientError({
    kind,
    message,
    retryable,
    status,
  })
}

function isAbortError(error) {
  return error?.name === 'AbortError'
}

function normalizeApiErrorMessage(errorMessage) {
  if (typeof errorMessage !== 'string') {
    return null
  }

  return errorMessage.trim().toLowerCase()
}

function parseApiError(errorMessage) {
  const normalized = normalizeApiErrorMessage(errorMessage)

  if (!normalized) {
    return createOmdbError(
      'invalid_response',
      'A OMDb retornou uma resposta inválida.',
      false,
    )
  }

  if (
    normalized.includes('invalid api key') ||
    normalized.includes('no api key') ||
    normalized.includes('api key')
  ) {
    return createOmdbError(
      'unauthorized',
      'A chave da OMDb está ausente ou inválida.',
      false,
    )
  }

  if (normalized.includes('not found')) {
    return createOmdbError(
      'not_found',
      'Nenhum resultado foi encontrado para a consulta informada.',
      false,
    )
  }

  if (
    normalized.includes('request limit reached') ||
    normalized.includes('too many requests')
  ) {
    return createOmdbError(
      'rate_limited',
      'Limite de requisições da OMDb atingido. Tente novamente em instantes.',
      true,
    )
  }

  return createOmdbError(
    'invalid_response',
    'A OMDb retornou uma resposta inválida.',
    false,
  )
}

function parseNetworkError(error) {
  if (isAbortError(error)) {
    return createOmdbError('network_error', 'A requisição foi cancelada.', true)
  }

  return createOmdbError(
    'network_error',
    'Não foi possível consultar a OMDb no momento.',
    true,
  )
}

function parseHttpError(status) {
  if (status === 401 || status === 403) {
    return createOmdbError(
      'unauthorized',
      'A chave da OMDb está ausente ou inválida.',
      false,
      status,
    )
  }

  if (status === 404) {
    return createOmdbError(
      'not_found',
      'Nenhum resultado foi encontrado para a consulta informada.',
      false,
      status,
    )
  }

  if (status === 429) {
    return createOmdbError(
      'rate_limited',
      'Limite de requisições da OMDb atingido. Tente novamente em instantes.',
      true,
      status,
    )
  }

  return createOmdbError(
    'network_error',
    'Não foi possível consultar a OMDb no momento.',
    true,
    status,
  )
}

function assertApiKey(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw createOmdbError(
      'unauthorized',
      'A chave da OMDb está ausente ou inválida.',
      false,
    )
  }
}

function mapOrThrow(mapper, payload) {
  try {
    return mapper(payload, { updatedAt: new Date().toISOString() })
  } catch {
    throw createOmdbError(
      'invalid_response',
      'A OMDb retornou uma resposta inválida.',
      false,
    )
  }
}

export function createOmdbClient(options = {}) {
  const env = getEnv()
  const baseUrl = options.baseUrl ?? env.VITE_OMDB_BASE_URL ?? DEFAULT_BASE_URL
  const apiKey = options.apiKey ?? env.VITE_OMDB_API_KEY ?? ''
  const fetchImpl = options.fetchImpl ?? fetch

  async function request(params = {}, requestOptions = {}) {
    assertApiKey(apiKey)

    const url = new URL(baseUrl)
    url.searchParams.set('apikey', apiKey)

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }

    let response

    try {
      response = await fetchImpl(url.toString(), {
        method: 'GET',
        signal: requestOptions.signal,
        headers: {
          Accept: 'application/json',
        },
      })
    } catch (error) {
      throw parseNetworkError(error)
    }

    if (!response.ok) {
      throw parseHttpError(response.status)
    }

    let payload

    try {
      payload = await response.json()
    } catch {
      throw createOmdbError(
        'invalid_response',
        'A OMDb retornou uma resposta inválida.',
        false,
      )
    }

    if (!payload || typeof payload !== 'object') {
      throw createOmdbError(
        'invalid_response',
        'A OMDb retornou uma resposta inválida.',
        false,
      )
    }

    if (payload.Response === 'False') {
      throw parseApiError(payload.Error)
    }

    return payload
  }

  async function searchMedia({ query, type, page = 1, signal } = {}) {
    if (typeof query !== 'string' || !query.trim()) {
      throw createOmdbError(
        'invalid_response',
        'Informe um termo válido para buscar mídias.',
        false,
      )
    }

    const payload = await request(
      {
        s: query.trim(),
        type,
        page,
      },
      { signal },
    )

    return mapOrThrow(mapOmdbSearchResponse, payload)
  }

  async function getMediaDetails({ imdbId, plot = 'full', signal } = {}) {
    if (typeof imdbId !== 'string' || !imdbId.trim()) {
      throw createOmdbError(
        'invalid_response',
        'Informe um identificador de mídia válido.',
        false,
      )
    }

    const payload = await request(
      {
        i: imdbId.trim(),
        plot,
      },
      { signal },
    )

    return mapOrThrow(mapOmdbDetailResponseToMedia, payload)
  }

  return {
    searchMedia,
    getMediaDetails,
  }
}

export const omdbClient = createOmdbClient()

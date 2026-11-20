const DEFAULT_BASE_URL = 'http://localhost:3001'

function getEnv() {
  if (typeof import.meta === 'undefined') {
    return {}
  }

  return import.meta.env ?? {}
}

function normalizePath(pathname) {
  if (typeof pathname !== 'string' || !pathname.trim()) {
    throw new TypeError('Informe um caminho válido para a requisição JSON Server.')
  }

  const normalized = pathname.trim()
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function getMessageFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim()
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }

  return null
}

function getDetailsFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (payload.details && typeof payload.details === 'object') {
    return payload.details
  }

  return null
}

export class JsonServerClientError extends Error {
  constructor({ code, message, details, status, retryable }) {
    super(message)
    this.name = 'JsonServerClientError'
    this.code = code
    this.details = details ?? null
    this.status = status ?? null
    this.retryable = retryable ?? false
  }
}

function createJsonServerError({ code, message, details, status, retryable }) {
  return new JsonServerClientError({
    code,
    message,
    details,
    status,
    retryable,
  })
}

function mapHttpError(status, payload) {
  const payloadMessage = getMessageFromPayload(payload)
  const payloadDetails = getDetailsFromPayload(payload)

  if (status === 400 || status === 422) {
    return createJsonServerError({
      code: 'VALIDATION_ERROR',
      message: payloadMessage ?? 'Dados inválidos para esta operação.',
      details: payloadDetails,
      status,
      retryable: false,
    })
  }

  if (status === 401 || status === 403) {
    return createJsonServerError({
      code: 'UNAUTHORIZED',
      message: payloadMessage ?? 'Você não possui permissão para esta operação.',
      details: payloadDetails,
      status,
      retryable: false,
    })
  }

  if (status === 404) {
    return createJsonServerError({
      code: 'NOT_FOUND',
      message: payloadMessage ?? 'Recurso não encontrado.',
      details: payloadDetails,
      status,
      retryable: false,
    })
  }

  if (status === 409) {
    return createJsonServerError({
      code: 'CONFLICT',
      message: payloadMessage ?? 'Conflito de dados detectado.',
      details: payloadDetails,
      status,
      retryable: false,
    })
  }

  if (status >= 500) {
    return createJsonServerError({
      code: 'SERVER_ERROR',
      message: payloadMessage ?? 'Falha interna ao processar requisição.',
      details: payloadDetails,
      status,
      retryable: true,
    })
  }

  return createJsonServerError({
    code: 'REQUEST_ERROR',
    message: payloadMessage ?? 'Falha ao processar a requisição.',
    details: payloadDetails,
    status,
    retryable: true,
  })
}

function mapNetworkError(error) {
  if (error?.name === 'AbortError') {
    return createJsonServerError({
      code: 'NETWORK_ERROR',
      message: 'A requisição foi cancelada.',
      details: null,
      retryable: true,
    })
  }

  return createJsonServerError({
    code: 'NETWORK_ERROR',
    message: 'Não foi possível se conectar ao JSON Server.',
    details: null,
    retryable: true,
  })
}

async function parseResponsePayload(response) {
  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (isJson) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  const text = await response.text()
  return text ? { message: text } : null
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(normalizePath(path), baseUrl)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, String(item))
        }
      }

      continue
    }

    url.searchParams.set(key, String(value))
  }

  return url
}

export function createJsonServerClient(options = {}) {
  const env = getEnv()
  const baseUrl = options.baseUrl ?? env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL
  // Resolve o fetch global a cada requisição para permitir interceptação por
  // ferramentas de mock (MSW) mesmo quando o cliente é criado no import.
  const fetchImpl =
    options.fetchImpl ?? ((...args) => globalThis.fetch(...args))

  async function request(path, requestOptions = {}) {
    const url = buildUrl(baseUrl, path, requestOptions.query)

    const headers = {
      Accept: 'application/json',
      ...(requestOptions.headers ?? {}),
    }

    const hasBody = requestOptions.body !== undefined && requestOptions.body !== null

    if (hasBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    let response

    try {
      response = await fetchImpl(url.toString(), {
        method: requestOptions.method ?? 'GET',
        headers,
        signal: requestOptions.signal,
        body: hasBody ? JSON.stringify(requestOptions.body) : undefined,
      })
    } catch (error) {
      throw mapNetworkError(error)
    }

    const payload = await parseResponsePayload(response)

    if (!response.ok) {
      throw mapHttpError(response.status, payload)
    }

    return payload
  }

  function get(path, options = {}) {
    return request(path, {
      ...options,
      method: 'GET',
    })
  }

  function post(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'POST',
      body,
    })
  }

  function patch(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'PATCH',
      body,
    })
  }

  function put(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'PUT',
      body,
    })
  }

  function remove(path, options = {}) {
    return request(path, {
      ...options,
      method: 'DELETE',
    })
  }

  return {
    request,
    get,
    post,
    patch,
    put,
    delete: remove,
  }
}

export const jsonServerClient = createJsonServerClient()

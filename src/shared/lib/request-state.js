export const REQUEST_STATUS = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
})

function normalizeError(error) {
  if (!error) {
    return null
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      retryable: error.retryable ?? true,
      code: error.code ?? null,
      status: error.status ?? null,
    }
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
      retryable: true,
      code: null,
      status: null,
    }
  }

  return {
    name: 'Error',
    message: 'Erro desconhecido na requisição.',
    retryable: true,
    code: null,
    status: null,
  }
}

function nowIso() {
  return new Date().toISOString()
}

export function createRequestState(partial = {}) {
  return {
    status: partial.status ?? REQUEST_STATUS.idle,
    data: partial.data ?? null,
    error: partial.error ?? null,
    attempt: Number.isInteger(partial.attempt) ? partial.attempt : 0,
    updatedAt: partial.updatedAt ?? nowIso(),
  }
}

export function resetRequestState(data = null) {
  return createRequestState({
    status: REQUEST_STATUS.idle,
    data,
    error: null,
    attempt: 0,
  })
}

export function setLoadingState(state = {}, options = {}) {
  const keepData = options.keepData ?? true

  return createRequestState({
    status: REQUEST_STATUS.loading,
    data: keepData ? (state?.data ?? null) : null,
    error: null,
    attempt: (state?.attempt ?? 0) + 1,
  })
}

export function setSuccessState(data, state = {}) {
  return createRequestState({
    status: REQUEST_STATUS.success,
    data,
    error: null,
    attempt: state?.attempt ?? 0,
  })
}

export function setErrorState(error, state = {}) {
  return createRequestState({
    status: REQUEST_STATUS.error,
    data: state?.data ?? null,
    error: normalizeError(error),
    attempt: state?.attempt ?? 0,
  })
}

export function isIdleState(state) {
  return state?.status === REQUEST_STATUS.idle
}

export function isLoadingState(state) {
  return state?.status === REQUEST_STATUS.loading
}

export function isSuccessState(state) {
  return state?.status === REQUEST_STATUS.success
}

export function isErrorState(state) {
  return state?.status === REQUEST_STATUS.error
}

export function canRetryRequest(state, options = {}) {
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 0

  if (!isErrorState(state)) {
    return false
  }

  const retryable = state?.error?.retryable !== false
  return retryable && (state?.attempt ?? 0) <= maxRetries
}

function wait(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function retryRequest(operation, options = {}) {
  if (typeof operation !== 'function') {
    throw new TypeError('retryRequest exige uma função assíncrona como operação.')
  }

  const retries = Number.isInteger(options.retries) ? options.retries : 0
  const retryDelayMs = Number.isFinite(options.retryDelayMs)
    ? Math.max(options.retryDelayMs, 0)
    : 0
  const shouldRetry =
    typeof options.shouldRetry === 'function'
      ? options.shouldRetry
      : (error) => error?.retryable !== false
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null

  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error

      const hasNextAttempt = attempt < retries
      if (!hasNextAttempt || !shouldRetry(error, attempt)) {
        throw error
      }

      if (onRetry) {
        onRetry({
          attempt: attempt + 1,
          retries,
          error,
        })
      }

      await wait(retryDelayMs)
    }
  }

  throw lastError ?? new Error('Falha desconhecida ao executar retryRequest.')
}

export async function runRequestWithState(operation, options = {}) {
  const onStateChange =
    typeof options.onStateChange === 'function' ? options.onStateChange : null
  const retries = Number.isInteger(options.retries) ? options.retries : 0
  const retryDelayMs = Number.isFinite(options.retryDelayMs)
    ? Math.max(options.retryDelayMs, 0)
    : 0

  let state = resetRequestState(options.initialData ?? null)
  state = setLoadingState(state)
  onStateChange?.(state)

  try {
    const data = await retryRequest(operation, {
      retries,
      retryDelayMs,
      shouldRetry: options.shouldRetry,
      onRetry: options.onRetry,
    })

    state = setSuccessState(data, state)
    onStateChange?.(state)
    return state
  } catch (error) {
    state = setErrorState(error, state)
    onStateChange?.(state)
    return state
  }
}

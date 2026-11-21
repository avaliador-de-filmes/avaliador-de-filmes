import { describe, expect, it, vi } from 'vitest'
import {
  REQUEST_STATUS,
  canRetryRequest,
  createRequestState,
  isErrorState,
  isIdleState,
  isLoadingState,
  isSuccessState,
  resetRequestState,
  retryRequest,
  runRequestWithState,
  setErrorState,
  setLoadingState,
  setSuccessState,
} from '../../src/shared/lib/request-state'

describe('request state factory', () => {
  it('creates an idle state by default', () => {
    const state = createRequestState()

    expect(state).toMatchObject({
      status: REQUEST_STATUS.idle,
      data: null,
      error: null,
      attempt: 0,
    })
    expect(typeof state.updatedAt).toBe('string')
  })

  it('keeps the provided partial values', () => {
    const state = createRequestState({
      status: REQUEST_STATUS.success,
      data: { ok: true },
      attempt: 2,
      updatedAt: '2026-11-20T00:00:00.000Z',
    })

    expect(state).toEqual({
      status: REQUEST_STATUS.success,
      data: { ok: true },
      error: null,
      attempt: 2,
      updatedAt: '2026-11-20T00:00:00.000Z',
    })
  })

  it('ignores a non integer attempt', () => {
    expect(createRequestState({ attempt: 1.5 }).attempt).toBe(0)
    expect(createRequestState({ attempt: '3' }).attempt).toBe(0)
  })

  it('resets the state keeping optional data', () => {
    expect(resetRequestState({ cached: true })).toMatchObject({
      status: REQUEST_STATUS.idle,
      data: { cached: true },
      error: null,
      attempt: 0,
    })
  })
})

describe('request state transitions', () => {
  it('moves to loading and increments the attempt counter', () => {
    const previous = createRequestState({ data: ['item'], attempt: 1 })
    const loading = setLoadingState(previous)

    expect(loading).toMatchObject({
      status: REQUEST_STATUS.loading,
      data: ['item'],
      error: null,
      attempt: 2,
    })
  })

  it('can drop the previous data while loading', () => {
    const previous = createRequestState({ data: ['item'], attempt: 1 })

    expect(setLoadingState(previous, { keepData: false }).data).toBeNull()
    expect(setLoadingState(undefined, { keepData: false }).attempt).toBe(1)
  })

  it('moves to success keeping the attempt counter', () => {
    const previous = createRequestState({ attempt: 3 })
    const success = setSuccessState({ value: 1 }, previous)

    expect(success).toMatchObject({
      status: REQUEST_STATUS.success,
      data: { value: 1 },
      error: null,
      attempt: 3,
    })
  })

  it('normalizes Error instances into the error contract', () => {
    const error = Object.assign(new Error('falhou'), {
      code: 'TIMEOUT',
      status: 504,
    })
    const previous = createRequestState({ data: ['cache'], attempt: 1 })
    const state = setErrorState(error, previous)

    expect(state).toMatchObject({
      status: REQUEST_STATUS.error,
      data: ['cache'],
      attempt: 1,
      error: {
        name: 'Error',
        message: 'falhou',
        retryable: true,
        code: 'TIMEOUT',
        status: 504,
      },
    })
  })

  it('normalizes string, unknown and empty errors', () => {
    expect(setErrorState('falha de rede').error).toEqual({
      name: 'Error',
      message: 'falha de rede',
      retryable: true,
      code: null,
      status: null,
    })

    expect(setErrorState({ any: true }).error).toEqual({
      name: 'Error',
      message: 'Erro desconhecido na requisição.',
      retryable: true,
      code: null,
      status: null,
    })

    expect(setErrorState(null).error).toBeNull()
  })

  it('keeps an explicit non retryable flag', () => {
    const error = Object.assign(new Error('sem permissão'), {
      retryable: false,
    })

    expect(setErrorState(error).error.retryable).toBe(false)
  })
})

describe('request state predicates', () => {
  it('identifies each status', () => {
    const idle = createRequestState()
    const loading = createRequestState({ status: REQUEST_STATUS.loading })
    const success = createRequestState({ status: REQUEST_STATUS.success })
    const error = createRequestState({ status: REQUEST_STATUS.error })

    expect(isIdleState(idle)).toBe(true)
    expect(isLoadingState(loading)).toBe(true)
    expect(isSuccessState(success)).toBe(true)
    expect(isErrorState(error)).toBe(true)

    expect(isIdleState(undefined)).toBe(false)
    expect(isLoadingState(success)).toBe(false)
    expect(isSuccessState(idle)).toBe(false)
    expect(isErrorState(loading)).toBe(false)
  })

  it('allows retry only for retryable errors within the attempt budget', () => {
    const state = setErrorState(new Error('falhou'), { attempt: 1 })

    expect(canRetryRequest(state, { maxRetries: 1 })).toBe(true)
    expect(canRetryRequest(state, { maxRetries: 0 })).toBe(false)
    expect(canRetryRequest(state)).toBe(false)

    const blocked = setErrorState(
      Object.assign(new Error('bloqueado'), { retryable: false }),
      { attempt: 0 },
    )

    expect(canRetryRequest(blocked, { maxRetries: 5 })).toBe(false)
    expect(canRetryRequest(createRequestState(), { maxRetries: 5 })).toBe(false)
  })
})

describe('retryRequest', () => {
  it('requires an operation function', async () => {
    await expect(retryRequest(null)).rejects.toThrow(TypeError)
    await expect(retryRequest('nope')).rejects.toThrow(
      /retryRequest exige uma função/,
    )
  })

  it('returns the first successful result', async () => {
    const operation = vi.fn(async () => 'ok')

    await expect(retryRequest(operation)).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(operation).toHaveBeenCalledWith(0)
  })

  it('retries retryable failures and reports each retry', async () => {
    const failure = Object.assign(new Error('instável'), { retryable: true })
    const operation = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('recuperado')
    const onRetry = vi.fn()

    await expect(
      retryRequest(operation, { retries: 1, onRetry }),
    ).resolves.toBe('recuperado')

    expect(operation).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      retries: 1,
      error: failure,
    })
  })

  it('throws the last error when every attempt fails', async () => {
    const operation = vi.fn(async () => {
      throw new Error('sempre falha')
    })

    await expect(retryRequest(operation, { retries: 2 })).rejects.toThrow(
      'sempre falha',
    )
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('stops immediately when shouldRetry returns false', async () => {
    const operation = vi.fn(async () => {
      throw Object.assign(new Error('não repete'), { retryable: true })
    })

    await expect(
      retryRequest(operation, { retries: 3, shouldRetry: () => false }),
    ).rejects.toThrow('não repete')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('accepts a custom retry delay without breaking the result', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('tentativa 1'))
      .mockResolvedValueOnce('ok')

    await expect(
      retryRequest(operation, { retries: 1, retryDelayMs: -10 }),
    ).resolves.toBe('ok')
  })
})

describe('runRequestWithState', () => {
  it('emits loading and success states around the operation', async () => {
    const onStateChange = vi.fn()

    const state = await runRequestWithState(async () => ['dado'], {
      onStateChange,
      initialData: ['inicial'],
    })

    expect(state).toMatchObject({
      status: REQUEST_STATUS.success,
      data: ['dado'],
      attempt: 1,
    })
    expect(onStateChange).toHaveBeenCalledTimes(2)
    expect(onStateChange.mock.calls[0][0]).toMatchObject({
      status: REQUEST_STATUS.loading,
      data: ['inicial'],
    })
    expect(onStateChange.mock.calls[1][0]).toMatchObject({
      status: REQUEST_STATUS.success,
      data: ['dado'],
    })
  })

  it('emits an error state when the operation fails', async () => {
    const onStateChange = vi.fn()

    const state = await runRequestWithState(
      async () => {
        throw new Error('offline')
      },
      { onStateChange },
    )

    expect(state.status).toBe(REQUEST_STATUS.error)
    expect(state.error).toMatchObject({ message: 'offline', retryable: true })
    expect(onStateChange).toHaveBeenCalledTimes(2)
    expect(onStateChange.mock.calls[1][0].status).toBe(REQUEST_STATUS.error)
  })

  it('works without an onStateChange callback', async () => {
    await expect(runRequestWithState(async () => 1)).resolves.toMatchObject({
      status: REQUEST_STATUS.success,
      data: 1,
    })
  })

  it('forwards retries and retry callbacks', async () => {
    const onRetry = vi.fn()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('tentativa'))
      .mockResolvedValueOnce('ok')

    const state = await runRequestWithState(operation, {
      retries: 1,
      onRetry,
    })

    expect(state.data).toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

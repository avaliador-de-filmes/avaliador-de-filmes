import { JsonServerClientError, jsonServerClient } from '../api/json-server/client'

export const AUTH_SESSION_MODE = Object.freeze({
  authenticated: 'authenticated',
  visitor: 'visitor',
})

const DEFAULT_STORAGE_KEY = 'avaliador.auth-session.mode'
const DEFAULT_USER_ID = 'u_1'

function getEnv() {
  if (typeof import.meta === 'undefined') {
    return {}
  }

  return import.meta.env ?? {}
}

function getDefaultUserId() {
  const env = getEnv()
  return env.VITE_TEST_USER_ID ?? DEFAULT_USER_ID
}

function createMemoryStorage() {
  const store = new Map()

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

function resolveStorage(customStorage) {
  if (customStorage) {
    return customStorage
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  return createMemoryStorage()
}

function normalizeMode(mode) {
  if (mode === AUTH_SESSION_MODE.visitor) {
    return AUTH_SESSION_MODE.visitor
  }

  return AUTH_SESSION_MODE.authenticated
}

function createVisitorSession() {
  return {
    isAuthenticated: false,
    mode: AUTH_SESSION_MODE.visitor,
    user: null,
    userId: null,
  }
}

function createAuthenticatedSession(user) {
  return {
    isAuthenticated: true,
    mode: AUTH_SESSION_MODE.authenticated,
    user,
    userId: user.id,
  }
}

export class AuthSessionError extends Error {
  constructor({ code, message, cause }) {
    super(message)
    this.name = 'AuthSessionError'
    this.code = code
    this.cause = cause ?? null
  }
}

export function createAuthSessionGateway(options = {}) {
  const client = options.client ?? jsonServerClient
  const storage = resolveStorage(options.storage)
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const testUserId = options.testUserId ?? getDefaultUserId()

  function getMode() {
    const saved = storage.getItem(storageKey)
    const normalized = normalizeMode(saved)

    if (saved !== normalized) {
      storage.setItem(storageKey, normalized)
    }

    return normalized
  }

  function setMode(mode) {
    const normalized = normalizeMode(mode)
    storage.setItem(storageKey, normalized)
    return normalized
  }

  function setVisitorMode() {
    return setMode(AUTH_SESSION_MODE.visitor)
  }

  function setAuthenticatedMode() {
    return setMode(AUTH_SESSION_MODE.authenticated)
  }

  async function fetchUserById(userId = testUserId) {
    const normalizedUserId =
      typeof userId === 'string' && userId.trim() ? userId.trim() : testUserId

    try {
      return await client.get(`/users/${normalizedUserId}`)
    } catch (error) {
      if (error instanceof JsonServerClientError && error.code === 'NOT_FOUND') {
        const users = await client.get('/users', {
          query: { id: normalizedUserId },
        })

        if (Array.isArray(users) && users.length > 0) {
          return users[0]
        }

        throw new AuthSessionError({
          code: 'USER_NOT_FOUND',
          message: 'Usuário de sessão simulada não encontrado.',
          cause: error,
        })
      }

      throw new AuthSessionError({
        code: 'SESSION_FETCH_FAILED',
        message: 'Não foi possível carregar o usuário da sessão simulada.',
        cause: error,
      })
    }
  }

  async function getSession() {
    const mode = getMode()

    if (mode === AUTH_SESSION_MODE.visitor) {
      return createVisitorSession()
    }

    const user = await fetchUserById()
    return createAuthenticatedSession(user)
  }

  async function requireAuthenticatedSession() {
    const session = await getSession()

    if (!session.isAuthenticated) {
      throw new AuthSessionError({
        code: 'UNAUTHORIZED',
        message: 'Operação disponível apenas para usuários autenticados.',
      })
    }

    return session
  }

  function clearSessionMode() {
    storage.removeItem(storageKey)
  }

  return {
    getMode,
    setMode,
    setVisitorMode,
    setAuthenticatedMode,
    clearSessionMode,
    getSession,
    requireAuthenticatedSession,
    fetchUserById,
  }
}

export const authSessionGateway = createAuthSessionGateway()

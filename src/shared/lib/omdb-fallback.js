export const OMDB_FALLBACK_DEFAULT_TITLE = 'Falha ao consultar a OMDb'
export const OMDB_FALLBACK_DEFAULT_MESSAGE =
  'Não foi possível consultar a OMDb no momento.'

/**
 * Mensagens de apoio por tipo de falha do adapter da OMDb
 * (`src/shared/api/omdb/client.js` — OmdbClientError.kind).
 */
export const OMDB_FALLBACK_GUIDANCE = Object.freeze({
  unauthorized:
    'Verifique se a variável de ambiente VITE_OMDB_API_KEY está configurada com uma chave válida.',
  not_found:
    'Confira o título ou o identificador informado e tente uma nova busca.',
  rate_limited:
    'O limite de requisições foi atingido. Aguarde alguns instantes antes de tentar novamente.',
  network_error: 'Verifique sua conexão e tente novamente.',
  invalid_response:
    'Tente novamente. Se o problema persistir, use os dados já salvos no catálogo local.',
})

export function resolveOmdbFallbackError(error) {
  if (!error) {
    return {
      message: OMDB_FALLBACK_DEFAULT_MESSAGE,
      kind: null,
      retryable: true,
    }
  }

  if (typeof error === 'string') {
    const message = error.trim()
    return {
      message: message || OMDB_FALLBACK_DEFAULT_MESSAGE,
      kind: null,
      retryable: true,
    }
  }

  const message =
    typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : OMDB_FALLBACK_DEFAULT_MESSAGE
  const rawKind = error.kind ?? error.code ?? null

  return {
    message,
    kind: typeof rawKind === 'string' && rawKind.trim() ? rawKind : null,
    retryable: error.retryable !== false,
  }
}

export function getOmdbFallbackGuidance(kind) {
  return kind ? OMDB_FALLBACK_GUIDANCE[kind] ?? null : null
}

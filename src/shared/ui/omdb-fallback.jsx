import { useId } from 'react'
import {
  OMDB_FALLBACK_DEFAULT_TITLE,
  getOmdbFallbackGuidance,
  resolveOmdbFallbackError,
} from '../lib/omdb-fallback'

/**
 * Fallback reutilizável para falhas da OMDb (FR-011), com mensagem clara,
 * orientação por tipo de erro e ação de nova tentativa acessível.
 */
export default function OmdbFallback({
  error = null,
  onRetry,
  isRetrying = false,
  title = OMDB_FALLBACK_DEFAULT_TITLE,
  retryLabel = 'Tentar novamente',
  retryingLabel = 'Tentando novamente...',
  fallbackMessage = null,
}) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const messageId = `${baseId}-message`

  const { message, kind, retryable } = resolveOmdbFallbackError(error)
  const guidance = getOmdbFallbackGuidance(kind)
  const canRetry = retryable && typeof onRetry === 'function'

  return (
    <section
      className="feedback feedback--error omdb-fallback"
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-busy={isRetrying ? 'true' : undefined}
      data-error-kind={kind ?? undefined}
    >
      <h2 id={titleId} className="omdb-fallback__title">
        {title}
      </h2>

      <p id={messageId}>{message}</p>

      {guidance && <p className="omdb-fallback__guidance">{guidance}</p>}

      {fallbackMessage && (
        <p className="omdb-fallback__local">{fallbackMessage}</p>
      )}

      {canRetry && (
        <button
          type="button"
          className="button button--secondary"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? retryingLabel : retryLabel}
        </button>
      )}
    </section>
  )
}

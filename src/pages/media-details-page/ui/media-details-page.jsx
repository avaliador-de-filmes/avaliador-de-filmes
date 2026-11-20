import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { omdbClient as defaultOmdbClient } from '../../../shared/api/omdb/client'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import { getMediaTypeLabel } from '../../../entities/media/model/media-type-label'
import MediaPoster from '../../../entities/media/ui/media-poster'
import { useAuthSession } from '../../../shared/lib/use-auth-session'
import SaveMediaControls from '../../../features/save-media/ui/save-media-controls'

const DETAIL_STATUS = Object.freeze({
  loading: 'loading',
  success: 'success',
  error: 'error',
})

export default function MediaDetailsPage({
  omdbClient = defaultOmdbClient,
  resources = jsonServerResources,
}) {
  const { mediaId } = useParams()
  const {
    userId,
    isAuthenticated,
    isLoading: isSessionLoading,
    error: sessionError,
    reload: reloadSession,
  } = useAuthSession()

  const [status, setStatus] = useState(DETAIL_STATUS.loading)
  const [media, setMedia] = useState(null)
  const [warning, setWarning] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    omdbClient
      .getMediaDetails({ imdbId: mediaId })
      .then((details) => {
        if (!active) {
          return
        }

        setMedia(details)
        setStatus(DETAIL_STATUS.success)
      })
      .catch(async (error) => {
        try {
          const localMedia = await resources.media.getById(mediaId)

          if (!active) {
            return
          }

          if (localMedia) {
            setMedia(localMedia)
            setWarning(
              'Não foi possível consultar a OMDb. Exibindo os dados salvos no catálogo local.',
            )
            setStatus(DETAIL_STATUS.success)
            return
          }
        } catch {
          // Falha do fallback local é tratada abaixo com a mensagem da OMDb.
        }

        if (!active) {
          return
        }

        setMedia(null)
        setErrorMessage(
          error?.message ?? 'Não foi possível carregar os detalhes da mídia.',
        )
        setStatus(DETAIL_STATUS.error)
      })

    return () => {
      active = false
    }
  }, [mediaId, omdbClient, resources, reloadToken])

  return (
    <main className="media-details-page">
      <p className="back-link">
        <Link to="/catalog">← Voltar para o catálogo</Link>
      </p>

      {status === DETAIL_STATUS.loading && (
        <p role="status">Carregando detalhes da mídia...</p>
      )}

      {status === DETAIL_STATUS.error && (
        <div className="feedback feedback--error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setStatus(DETAIL_STATUS.loading)
              setWarning('')
              setErrorMessage('')
              setReloadToken((token) => token + 1)
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === DETAIL_STATUS.success && media && (
        <>
          <article className="media-details" aria-labelledby="media-title">
            <MediaPoster
              className="media-details__poster"
              src={media.posterUrl}
              alt={`Capa de ${media.title}`}
              loading="eager"
            />

            <div className="media-details__body">
              <p className="eyebrow">{getMediaTypeLabel(media.type)}</p>
              <h1 id="media-title">{media.title}</h1>
              <p className="media-details__meta">
                {media.year}
                {media.imdbRating !== null && media.imdbRating !== undefined
                  ? ` · IMDb ${media.imdbRating}`
                  : ''}
              </p>

              {warning && (
                <p className="feedback feedback--warning" role="status">
                  {warning}
                </p>
              )}

              {Array.isArray(media.genres) && media.genres.length > 0 && (
                <p>
                  <strong>Gêneros:</strong> {media.genres.join(', ')}
                </p>
              )}

              <p>{media.plot ?? 'Sinopse não disponível.'}</p>
            </div>
          </article>

          {isSessionLoading && <p role="status">Carregando sessão...</p>}

          {!isSessionLoading && sessionError && (
            <div className="feedback feedback--error" role="alert">
              <p>
                Não foi possível carregar a sessão:{' '}
                {sessionError.message ?? 'erro desconhecido.'}
              </p>
              <button
                type="button"
                className="button button--secondary"
                onClick={reloadSession}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isSessionLoading && !sessionError && (
            <SaveMediaControls
              key={media.id}
              userId={userId}
              media={media}
              isAuthenticated={isAuthenticated}
              resources={resources}
            />
          )}
        </>
      )}
    </main>
  )
}

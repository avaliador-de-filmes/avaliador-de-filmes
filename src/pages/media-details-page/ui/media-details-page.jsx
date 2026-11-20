import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { omdbClient as defaultOmdbClient } from '../../../shared/api/omdb/client'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import { getMediaTypeLabel } from '../../../entities/media/model/media-type-label'
import MediaPoster from '../../../entities/media/ui/media-poster'
import { announceToLiveRegion } from '../../../shared/lib/accessibility'
import { useAuthSession } from '../../../shared/lib/use-auth-session'
import SaveMediaControls from '../../../features/save-media/ui/save-media-controls'
import {
  deleteReview,
  getActiveReview,
} from '../../../features/review-media/model/review-media'
import {
  REVIEW_ACTIONS,
  evaluateReviewAction,
} from '../../../features/review-media/model/review-permissions'
import ReviewForm from '../../../features/review-media/ui/review-form'
import PublicReviews from '../../../widgets/public-reviews/ui/public-reviews'

const DETAIL_STATUS = Object.freeze({
  loading: 'loading',
  success: 'success',
  error: 'error',
})

const OWN_REVIEW_STATUS = Object.freeze({
  loading: 'loading',
  ready: 'ready',
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

  const [activeReview, setActiveReview] = useState(null)
  const [ownReviewStatus, setOwnReviewStatus] = useState(
    OWN_REVIEW_STATUS.loading,
  )
  const [reviewError, setReviewError] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0)
  const [ownReviewReloadToken, setOwnReviewReloadToken] = useState(0)
  const [editFocusToken, setEditFocusToken] = useState(0)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [isDeletingReview, setIsDeletingReview] = useState(false)

  const canLoadOwnReview = Boolean(isAuthenticated && userId && media?.id)

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

  useEffect(() => {
    let active = true

    if (!canLoadOwnReview) {
      return undefined
    }

    getActiveReview({ userId, mediaId: media.id, resources })
      .then((review) => {
        if (!active) {
          return
        }

        setActiveReview(review)
        setOwnReviewStatus(OWN_REVIEW_STATUS.ready)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setReviewError(
          error?.message ?? 'Não foi possível carregar sua resenha.',
        )
        setOwnReviewStatus(OWN_REVIEW_STATUS.error)
      })

    return () => {
      active = false
    }
  }, [
    canLoadOwnReview,
    userId,
    media?.id,
    resources,
    ownReviewReloadToken,
  ])

  // Visitantes nunca possuem resenha própria carregada, mesmo que o estado
  // local ainda guarde dados de uma sessão anterior.
  const effectiveActiveReview = canLoadOwnReview ? activeReview : null
  const effectiveOwnReviewStatus = canLoadOwnReview
    ? ownReviewStatus
    : OWN_REVIEW_STATUS.ready

  function refreshReviewContent() {
    setOwnReviewReloadToken((token) => token + 1)
    setReviewRefreshToken((token) => token + 1)
  }

  function handleReviewPublished() {
    setReviewError('')
    refreshReviewContent()
  }

  function handleEditReview(review) {
    const decision = evaluateReviewAction({
      action: REVIEW_ACTIONS.edit,
      isAuthenticated,
      currentUserId: userId,
      review,
    })

    if (!decision.allowed) {
      setReviewError(decision.message)
      announceToLiveRegion(decision.message, { politeness: 'assertive' })
      return
    }

    setActiveReview(review)
    setReviewError('')
    setReviewFeedback(
      'Editando sua resenha. O formulário acima está pronto para alterações.',
    )
    setEditFocusToken((token) => token + 1)
  }

  function handleDeleteReview(review) {
    const decision = evaluateReviewAction({
      action: REVIEW_ACTIONS.delete,
      isAuthenticated,
      currentUserId: userId,
      review,
    })

    if (!decision.allowed) {
      setReviewError(decision.message)
      announceToLiveRegion(decision.message, { politeness: 'assertive' })
      return
    }

    setPendingDelete(review)
    setReviewFeedback('')
    setReviewError('')
  }

  function handleCancelDelete() {
    setPendingDelete(null)
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || isDeletingReview) {
      return
    }

    setIsDeletingReview(true)
    setReviewError('')

    try {
      await deleteReview({
        reviewId: pendingDelete.id,
        userId,
        resources,
      })

      setPendingDelete(null)
      setReviewFeedback('Resenha excluída com sucesso.')
      announceToLiveRegion('Resenha excluída com sucesso.')
      refreshReviewContent()
    } catch (error) {
      const message =
        error?.message ?? 'Não foi possível excluir sua resenha.'
      setReviewError(message)
      announceToLiveRegion(message, { politeness: 'assertive' })
    } finally {
      setIsDeletingReview(false)
    }
  }

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
            <>
              <SaveMediaControls
                key={media.id}
                userId={userId}
                media={media}
                isAuthenticated={isAuthenticated}
                resources={resources}
              />

              <section
                className="media-reviews"
                aria-label="Resenhas da mídia"
              >
                {effectiveOwnReviewStatus === OWN_REVIEW_STATUS.loading && (
                  <p role="status">Carregando sua resenha...</p>
                )}

                {effectiveOwnReviewStatus === OWN_REVIEW_STATUS.error && (
                  <div className="feedback feedback--error" role="alert">
                    <p>{reviewError}</p>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        setReviewError('')
                        setOwnReviewStatus(OWN_REVIEW_STATUS.loading)
                        setOwnReviewReloadToken((token) => token + 1)
                      }}
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}

                {effectiveOwnReviewStatus !== OWN_REVIEW_STATUS.error && (
                  <ReviewForm
                    userId={userId}
                    mediaId={media.id}
                    review={effectiveActiveReview}
                    isAuthenticated={isAuthenticated}
                    resources={resources}
                    focusToken={editFocusToken}
                    onPublished={handleReviewPublished}
                  />
                )}

                {pendingDelete && (
                  <div
                    className="feedback feedback--warning"
                    role="alertdialog"
                    aria-labelledby="delete-review-heading"
                    aria-describedby="delete-review-description"
                  >
                    <p id="delete-review-heading">
                      Excluir sua resenha?
                    </p>
                    <p id="delete-review-description">
                      O texto deixará de aparecer na área pública desta mídia.
                    </p>
                    <div className="review-actions">
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={handleConfirmDelete}
                        disabled={isDeletingReview}
                      >
                        {isDeletingReview
                          ? 'Excluindo...'
                          : 'Confirmar exclusão'}
                      </button>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={handleCancelDelete}
                        disabled={isDeletingReview}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {reviewError &&
                  effectiveOwnReviewStatus !== OWN_REVIEW_STATUS.error && (
                  <p className="feedback feedback--error" role="alert">
                    {reviewError}
                  </p>
                )}

                {reviewFeedback && (
                  <p className="feedback feedback--success" role="status">
                    {reviewFeedback}
                  </p>
                )}

                <PublicReviews
                  mediaId={media.id}
                  currentUserId={userId}
                  isAuthenticated={isAuthenticated}
                  resources={resources}
                  refreshToken={reviewRefreshToken}
                  onEditReview={handleEditReview}
                  onDeleteReview={handleDeleteReview}
                />
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}

import { useEffect, useId, useState } from 'react'
import { listPublicReviews } from '../../../features/review-media/model/review-media'
import { getReviewPermissions } from '../../../features/review-media/model/review-permissions'
import { jsonServerResources } from '../../../shared/api/json-server/resources'

const LIST_STATUS = Object.freeze({
  loading: 'loading',
  ready: 'ready',
  error: 'error',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatReviewDate(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null
  }

  return DATE_FORMATTER.format(new Date(value))
}

function wasEdited(review) {
  const published = Date.parse(review?.publishedAt)
  const updated = Date.parse(review?.updatedAt)

  return (
    !Number.isNaN(published) && !Number.isNaN(updated) && updated > published
  )
}

/**
 * Lista as resenhas públicas de uma mídia para usuários autenticados e
 * visitantes (FR-013/FR-014). Registros com Review.isDeleted = true são
 * omitidos pela camada de domínio. Ações de edição/exclusão só aparecem para
 * o autor autenticado e quando o consumidor fornece os callbacks — visitantes
 * permanecem em modo somente leitura.
 */
export default function PublicReviews({
  mediaId,
  currentUserId = null,
  isAuthenticated = false,
  resources = jsonServerResources,
  onEditReview,
  onDeleteReview,
  refreshToken = 0,
  heading = 'Resenhas públicas',
}) {
  const headingId = useId()
  const [status, setStatus] = useState(LIST_STATUS.loading)
  const [reviews, setReviews] = useState([])
  const [usersById, setUsersById] = useState(() => new Map())
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    listPublicReviews({ mediaId, resources })
      .then(async (publicReviews) => {
        const userIds = Array.from(
          new Set(
            publicReviews
              .map((review) => review?.userId)
              .filter((userId) => typeof userId === 'string' && userId.trim()),
          ),
        )

        let users = []

        if (userIds.length > 0 && resources.users?.listByIds) {
          // A autoria é complementar: se a consulta de usuários falhar, a
          // resenha continua visível usando o identificador como fallback.
          users = await resources.users.listByIds(userIds).catch(() => [])
        }

        if (!active) {
          return
        }

        setReviews(publicReviews)
        setUsersById(new Map(users.map((user) => [user.id, user])))
        setStatus(LIST_STATUS.ready)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setErrorMessage(
          error?.message ?? 'Não foi possível carregar as resenhas públicas.',
        )
        setStatus(LIST_STATUS.error)
      })

    return () => {
      active = false
    }
  }, [mediaId, resources, refreshToken, reloadToken])

  function handleRetry() {
    setStatus(LIST_STATUS.loading)
    setErrorMessage('')
    setReloadToken((token) => token + 1)
  }

  return (
    <section className="public-reviews" aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">
        {heading}
      </h2>

      {status === LIST_STATUS.loading && (
        <p role="status">Carregando resenhas públicas...</p>
      )}

      {status === LIST_STATUS.error && (
        <div className="feedback feedback--error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === LIST_STATUS.ready && reviews.length === 0 && (
        <p className="feedback">
          Ainda não há resenhas públicas para esta mídia.
        </p>
      )}

      {status === LIST_STATUS.ready && reviews.length > 0 && (
        <ul className="public-reviews__list">
          {reviews.map((review) => {
            const author = usersById.get(review.userId)
            const authorName =
              author?.displayName || author?.username || review.userId
            const publishedAt = formatReviewDate(review.publishedAt)
            const updatedAt = formatReviewDate(review.updatedAt)
            const isOwner = getReviewPermissions({
              isAuthenticated,
              currentUserId,
              review,
            }).isOwner

            return (
              <li key={review.id} className="public-reviews__item">
                <h3 className="public-reviews__author">{authorName}</h3>

                <p className="public-reviews__meta">
                  {isOwner ? 'Sua resenha · ' : ''}
                  Publicada em {publishedAt ?? 'data não informada'}
                  {wasEdited(review) && updatedAt
                    ? ` · Editada em ${updatedAt}`
                    : ''}
                </p>

                <p className="public-reviews__content">{review.content}</p>

                {isOwner && (onEditReview || onDeleteReview) && (
                  <div className="public-reviews__actions">
                    {onEditReview && (
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => onEditReview(review)}
                      >
                        Editar resenha
                      </button>
                    )}

                    {onDeleteReview && (
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => onDeleteReview(review)}
                      >
                        Excluir resenha
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

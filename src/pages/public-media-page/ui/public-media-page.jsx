import { useEffect, useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMediaTypeLabel } from '../../../entities/media/model/media-type-label'
import MediaPoster from '../../../entities/media/ui/media-poster'
import { calculateMediaRatingSummary } from '../../../entities/rating/model/media-rating-summary'
import { RATING_CONSTRAINTS } from '../../../entities/rating/model/rating.schema'
import { omdbClient as defaultOmdbClient } from '../../../shared/api/omdb/client'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import PublicReviews from '../../../widgets/public-reviews/ui/public-reviews'

const DETAIL_STATUS = Object.freeze({
  loading: 'loading',
  success: 'success',
  error: 'error',
})

const RATINGS_STATUS = Object.freeze({
  loading: 'loading',
  ready: 'ready',
  error: 'error',
})

const INITIAL_DETAIL = Object.freeze({
  mediaId: null,
  status: DETAIL_STATUS.loading,
  media: null,
  warning: '',
  errorMessage: '',
})

const INITIAL_RATINGS = Object.freeze({
  mediaId: null,
  status: RATINGS_STATUS.loading,
  items: [],
  usersById: null,
  errorMessage: '',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const AVERAGE_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

function formatDate(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null
  }

  return DATE_FORMATTER.format(new Date(value))
}

function isValidRatingValue(value) {
  const numeric = Number(value)
  return (
    Number.isInteger(numeric) &&
    numeric >= RATING_CONSTRAINTS.min &&
    numeric <= RATING_CONSTRAINTS.max
  )
}

/**
 * A página pública tenta a OMDb primeiro e, quando o provedor externo falha,
 * usa a mídia já sincronizada no JSON Server (FR-011 e contrato OMDb).
 */
async function fetchPublicMedia({ mediaId, omdbClient, resources }) {
  try {
    const details = await omdbClient.getMediaDetails({ imdbId: mediaId })
    return { media: details, usedFallback: false }
  } catch (error) {
    const localMedia = await resources.media.getById(mediaId).catch(() => null)

    if (localMedia) {
      return { media: localMedia, usedFallback: true }
    }

    throw error
  }
}

/**
 * Página pública de leitura de uma mídia (FR-013/FR-014, US3/AC3 e US3/AC4).
 *
 * Não consulta sessão nem renderiza formulários ou ações de salvar, avaliar,
 * editar e excluir: visitantes e usuários autenticados veem apenas o conteúdo
 * público. As regras de autoria das resenhas permanecem no widget
 * `PublicReviews`, que recebe explicitamente o modo somente leitura.
 */
export default function PublicMediaPage({
  omdbClient = defaultOmdbClient,
  resources = jsonServerResources,
}) {
  const { mediaId } = useParams()
  const ratingsHeadingId = useId()

  const [detail, setDetail] = useState(INITIAL_DETAIL)
  const [ratings, setRatings] = useState(INITIAL_RATINGS)
  const [reloadToken, setReloadToken] = useState(0)
  const [ratingsReloadToken, setRatingsReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    fetchPublicMedia({ mediaId, omdbClient, resources })
      .then(({ media, usedFallback }) => {
        if (!active) {
          return
        }

        setDetail({
          mediaId,
          status: DETAIL_STATUS.success,
          media,
          warning: usedFallback
            ? 'Não foi possível consultar a OMDb. Exibindo os dados salvos no catálogo local.'
            : '',
          errorMessage: '',
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setDetail({
          mediaId,
          status: DETAIL_STATUS.error,
          media: null,
          warning: '',
          errorMessage:
            error?.message ?? 'Não foi possível carregar os detalhes da mídia.',
        })
      })

    return () => {
      active = false
    }
  }, [mediaId, omdbClient, resources, reloadToken])

  const currentMediaId =
    detail.status === DETAIL_STATUS.success ? detail.media?.id : null

  useEffect(() => {
    let active = true

    if (!currentMediaId) {
      return undefined
    }

    resources.ratings
      .listByMedia(currentMediaId)
      .then(async (items) => {
        const userIds = Array.from(
          new Set(
            (Array.isArray(items) ? items : [])
              .map((rating) => rating?.userId)
              .filter((userId) => typeof userId === 'string' && userId.trim()),
          ),
        )

        let users = []

        if (userIds.length > 0 && resources.users?.listByIds) {
          // A autoria é complementar: sem os usuários, exibimos o identificador.
          users = await resources.users.listByIds(userIds).catch(() => [])
        }

        if (!active) {
          return
        }

        setRatings({
          mediaId: currentMediaId,
          status: RATINGS_STATUS.ready,
          items: Array.isArray(items) ? items : [],
          usersById: new Map(users.map((user) => [user.id, user])),
          errorMessage: '',
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setRatings({
          mediaId: currentMediaId,
          status: RATINGS_STATUS.error,
          items: [],
          usersById: null,
          errorMessage:
            error?.message ?? 'Não foi possível carregar as avaliações públicas.',
        })
      })

    return () => {
      active = false
    }
  }, [currentMediaId, resources, ratingsReloadToken])

  function handleRetryDetails() {
    setDetail((state) => ({ ...state, status: DETAIL_STATUS.loading }))
    setReloadToken((token) => token + 1)
  }

  function handleRetryRatings() {
    setRatings((state) => ({
      ...state,
      status: RATINGS_STATUS.loading,
      errorMessage: '',
    }))
    setRatingsReloadToken((token) => token + 1)
  }

  const detailPending =
    detail.mediaId !== mediaId || detail.status === DETAIL_STATUS.loading

  const ratingsPending =
    ratings.mediaId !== currentMediaId ||
    ratings.status === RATINGS_STATUS.loading

  const usersById = ratings.usersById ?? new Map()
  const visibleRatings = ratings.items.filter((rating) =>
    isValidRatingValue(rating?.value),
  )
  const summary = calculateMediaRatingSummary(
    currentMediaId ?? '',
    ratings.items,
  )

  return (
    <main className="public-media-page">
      <p className="back-link">
        <Link to="/">← Voltar para o início</Link>
      </p>

      {detailPending && (
        <p role="status">Carregando página pública da mídia...</p>
      )}

      {!detailPending && detail.status === DETAIL_STATUS.error && (
        <div className="feedback feedback--error" role="alert">
          <p>{detail.errorMessage}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleRetryDetails}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!detailPending && detail.status === DETAIL_STATUS.success && detail.media && (
        <>
          <article className="media-details" aria-labelledby="public-media-title">
            <MediaPoster
              className="media-details__poster"
              src={detail.media.posterUrl}
              alt={`Capa de ${detail.media.title}`}
              loading="eager"
            />

            <div className="media-details__body">
              <p className="eyebrow">{getMediaTypeLabel(detail.media.type)}</p>
              <h1 id="public-media-title">{detail.media.title}</h1>
              <p className="media-details__meta">
                {detail.media.year}
                {detail.media.imdbRating !== null &&
                detail.media.imdbRating !== undefined
                  ? ` · IMDb ${detail.media.imdbRating}`
                  : ''}
              </p>

              {detail.warning && (
                <p className="feedback feedback--warning" role="status">
                  {detail.warning}
                </p>
              )}

              {Array.isArray(detail.media.genres) &&
                detail.media.genres.length > 0 && (
                  <p>
                    <strong>Gêneros:</strong> {detail.media.genres.join(', ')}
                  </p>
                )}

              <p>{detail.media.plot ?? 'Sinopse não disponível.'}</p>
            </div>
          </article>

          <p className="feedback">
            Visualização pública e somente leitura: criar, editar e excluir
            conteúdo exige uma sessão autenticada.
          </p>

          <section className="public-ratings" aria-labelledby={ratingsHeadingId}>
            <h2 id={ratingsHeadingId} className="section-title">
              Avaliações públicas
            </h2>

            {ratingsPending && (
              <p role="status">Carregando avaliações públicas...</p>
            )}

            {!ratingsPending && ratings.status === RATINGS_STATUS.error && (
              <div className="feedback feedback--error" role="alert">
                <p>{ratings.errorMessage}</p>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleRetryRatings}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!ratingsPending && ratings.status === RATINGS_STATUS.ready && (
              <>
                <p className="public-ratings__summary">
                  Nota média:{' '}
                  <strong>
                    {AVERAGE_FORMATTER.format(summary.averageRating)}
                  </strong>{' '}
                  · {summary.ratingsCount}{' '}
                  {summary.ratingsCount === 1 ? 'avaliação' : 'avaliações'}
                </p>

                {visibleRatings.length === 0 ? (
                  <p className="feedback">
                    Ainda não há avaliações públicas para esta mídia.
                  </p>
                ) : (
                  <ul className="public-ratings__list">
                    {visibleRatings.map((rating, index) => {
                      const author = usersById.get(rating.userId)
                      const authorName =
                        author?.displayName || author?.username || rating.userId
                      const date = formatDate(
                        rating.updatedAt ?? rating.createdAt,
                      )

                      return (
                        <li
                          key={rating.id ?? `${rating.userId}-${index}`}
                          className="public-ratings__item"
                        >
                          <p className="public-ratings__meta">
                            <strong>{authorName}</strong> · {rating.value} de{' '}
                            {RATING_CONSTRAINTS.max} ·{' '}
                            {date ? `Avaliado em ${date}` : 'Data não informada'}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </section>

          <PublicReviews
            mediaId={currentMediaId}
            resources={resources}
            isAuthenticated={false}
            currentUserId={null}
            heading="Resenhas públicas"
          />
        </>
      )}
    </main>
  )
}

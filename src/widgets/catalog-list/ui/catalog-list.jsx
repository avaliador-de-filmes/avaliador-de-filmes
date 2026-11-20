import { useEffect, useState } from 'react'
import {
  CATALOG_ITEM_STATUS_OPTIONS,
  getCatalogStatusLabel,
} from '../../../entities/catalog-item/model/catalog-item-status'
import { getMediaTypeLabel } from '../../../entities/media/model/media-type-label'
import MediaPoster from '../../../entities/media/ui/media-poster'
import { updateCatalogItemStatus } from '../../../features/update-status/model/update-status'
import { removeCatalogItem } from '../../../features/update-status/model/remove-catalog-item'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import { announceToLiveRegion } from '../../../shared/lib/accessibility'

const LIST_STATUS = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
})

function getEntryTitle(entry) {
  return entry.media?.title ?? entry.item.mediaId
}

export default function CatalogList({
  userId,
  resources = jsonServerResources,
}) {
  const [status, setStatus] = useState(LIST_STATUS.loading)
  const [entries, setEntries] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    if (!userId) {
      return undefined
    }

    resources.catalogItems
      .listByUser(userId)
      .then(async (items) => {
        const mediaList = await resources.media.listByIds(
          items.map((item) => item.mediaId),
        )

        if (!active) {
          return
        }

        const mediaById = new Map(mediaList.map((media) => [media.id, media]))

        setEntries(
          items.map((item) => ({
            item,
            media: mediaById.get(item.mediaId) ?? null,
          })),
        )
        setStatus(LIST_STATUS.success)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setErrorMessage(
          error?.message ?? 'Não foi possível carregar o catálogo pessoal.',
        )
        setStatus(LIST_STATUS.error)
      })

    return () => {
      active = false
    }
  }, [userId, resources, reloadToken])

  async function handleStatusChange(entry, nextStatus) {
    setPendingId(entry.item.id)
    setActionError('')
    setFeedback('')

    try {
      const updated = await updateCatalogItemStatus({
        id: entry.item.id,
        status: nextStatus,
        resources,
      })

      setEntries((currentEntries) =>
        currentEntries.map((current) =>
          current.item.id === entry.item.id
            ? { ...current, item: { ...current.item, ...updated } }
            : current,
        ),
      )

      const message = `Status de ${getEntryTitle(entry)} atualizado para ${getCatalogStatusLabel(nextStatus)}.`
      setFeedback(message)
      announceToLiveRegion(message)
    } catch (error) {
      setActionError(
        error?.message ?? 'Não foi possível atualizar o status do item.',
      )
    } finally {
      setPendingId(null)
    }
  }

  async function handleRemove(entry) {
    setPendingId(entry.item.id)
    setActionError('')
    setFeedback('')

    try {
      await removeCatalogItem({ id: entry.item.id, resources })

      setEntries((currentEntries) =>
        currentEntries.filter((current) => current.item.id !== entry.item.id),
      )

      const message = `${getEntryTitle(entry)} foi removido do catálogo.`
      setFeedback(message)
      announceToLiveRegion(message)
    } catch (error) {
      setActionError(
        error?.message ?? 'Não foi possível remover o item do catálogo.',
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="catalog-list" aria-labelledby="catalog-list-heading">
      <h2 id="catalog-list-heading" className="section-title">
        Meu catálogo
      </h2>

      {status === LIST_STATUS.loading && (
        <p role="status">Carregando seu catálogo...</p>
      )}

      {status === LIST_STATUS.error && (
        <div className="feedback feedback--error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setStatus(LIST_STATUS.loading)
              setErrorMessage('')
              setReloadToken((token) => token + 1)
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === LIST_STATUS.success && entries.length === 0 && (
        <p className="feedback">
          Seu catálogo está vazio. Use a busca acima para adicionar filmes e
          séries.
        </p>
      )}

      {entries.length > 0 && (
        <ul className="catalog-items">
          {entries.map((entry) => {
            const title = getEntryTitle(entry)
            const isPending = pendingId === entry.item.id
            const statusFieldId = `catalog-status-${entry.item.id}`

            return (
              <li key={entry.item.id} className="catalog-item">
                <MediaPoster
                  className="catalog-item__poster"
                  src={entry.media?.posterUrl}
                  alt={`Capa de ${title}`}
                />

                <div className="catalog-item__body">
                  <h3 className="catalog-item__title">{title}</h3>
                  <p className="catalog-item__meta">
                    {entry.media?.year ?? '—'} ·{' '}
                    {getMediaTypeLabel(entry.media?.type)}
                  </p>
                  <p className="catalog-item__status">
                    Status atual: {getCatalogStatusLabel(entry.item.status)}
                  </p>

                  <div className="catalog-item__actions">
                    <div className="field field--inline">
                      <label className="sr-only" htmlFor={statusFieldId}>
                        Status de {title}
                      </label>
                      <select
                        id={statusFieldId}
                        value={entry.item.status}
                        disabled={isPending}
                        onChange={(event) =>
                          handleStatusChange(entry, event.target.value)
                        }
                      >
                        {CATALOG_ITEM_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => handleRemove(entry)}
                      disabled={isPending}
                      aria-label={`Remover ${title} do catálogo`}
                    >
                      {isPending ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {actionError && (
        <p className="feedback feedback--error" role="alert">
          {actionError}
        </p>
      )}

      {feedback && (
        <p className="feedback feedback--success" role="status">
          {feedback}
        </p>
      )}
    </section>
  )
}

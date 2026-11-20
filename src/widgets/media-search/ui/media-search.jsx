import { useState } from 'react'
import { Link } from 'react-router-dom'
import { omdbClient as defaultOmdbClient } from '../../../shared/api/omdb/client'
import { getMediaTypeLabel } from '../../../entities/media/model/media-type-label'
import MediaPoster from '../../../entities/media/ui/media-poster'
import { announceToLiveRegion } from '../../../shared/lib/accessibility'

const PAGE_SIZE = 10

const SEARCH_STATUS = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
})

export default function MediaSearch({ omdbClient = defaultOmdbClient }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [items, setItems] = useState([])
  const [totalResults, setTotalResults] = useState(0)
  const [status, setStatus] = useState(SEARCH_STATUS.idle)
  const [errorMessage, setErrorMessage] = useState('')

  const isLoading = status === SEARCH_STATUS.loading
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE))

  async function runSearch(term, targetPage) {
    const normalizedTerm = term.trim()

    if (!normalizedTerm) {
      setStatus(SEARCH_STATUS.idle)
      setItems([])
      setTotalResults(0)
      return
    }

    setStatus(SEARCH_STATUS.loading)
    setErrorMessage('')

    try {
      const result = await omdbClient.searchMedia({
        query: normalizedTerm,
        type: type || undefined,
        page: targetPage,
      })

      setItems(result.items)
      setTotalResults(result.totalResults)
      setSubmittedQuery(normalizedTerm)
      setPage(targetPage)
      setStatus(SEARCH_STATUS.success)
      announceToLiveRegion(
        `${result.items.length} resultado(s) encontrado(s) para ${normalizedTerm}.`,
      )
    } catch (error) {
      setItems([])
      setTotalResults(0)
      setErrorMessage(error?.message ?? 'Não foi possível buscar mídias.')
      setStatus(SEARCH_STATUS.error)
      announceToLiveRegion('Não foi possível concluir a busca.', {
        politeness: 'assertive',
      })
    }
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (isLoading) {
      return
    }

    runSearch(query, 1)
  }

  function handleRetry() {
    if (isLoading) {
      return
    }

    runSearch(submittedQuery || query, page)
  }

  return (
    <section className="media-search" aria-labelledby="media-search-heading">
      <h2 id="media-search-heading" className="section-title">
        Buscar filmes e séries
      </h2>

      <form className="media-search__form" role="search" onSubmit={handleSubmit}>
        <div className="field field--grow">
          <label htmlFor="media-search-query">Título da mídia</label>
          <input
            id="media-search-query"
            name="query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: Matrix, Breaking Bad"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="media-search-type">Tipo</label>
          <select
            id="media-search-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="movie">Filmes</option>
            <option value="series">Séries</option>
          </select>
        </div>

        <button type="submit" className="button" disabled={isLoading}>
          {isLoading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {isLoading && <p role="status">Buscando mídias na OMDb...</p>}

      {status === SEARCH_STATUS.error && (
        <div className="feedback feedback--error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" className="button button--secondary" onClick={handleRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === SEARCH_STATUS.success && (
        <p className="results-count" role="status">
          {totalResults} resultado(s) para “{submittedQuery}”.
        </p>
      )}

      {status === SEARCH_STATUS.success && items.length === 0 && (
        <p className="feedback">Nenhum resultado encontrado para “{submittedQuery}”.</p>
      )}

      {items.length > 0 && (
        <ul className="media-grid" aria-label="Resultados da busca">
          {items.map((item) => (
            <li key={item.id} className="media-card">
              <MediaPoster
                className="media-card__poster"
                src={item.posterUrl}
                alt={`Capa de ${item.title}`}
              />

              <div className="media-card__body">
                <h3 className="media-card__title">{item.title}</h3>
                <p className="media-card__meta">
                  {item.year} · {getMediaTypeLabel(item.type)}
                </p>
                <Link className="button button--secondary" to={`/media/${item.id}`}>
                  Ver detalhes
                  <span className="sr-only"> de {item.title}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === SEARCH_STATUS.success && items.length > 0 && (
        <nav className="pagination" aria-label="Paginação da busca">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => runSearch(submittedQuery, page - 1)}
            disabled={isLoading || page <= 1}
          >
            Página anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => runSearch(submittedQuery, page + 1)}
            disabled={isLoading || page >= totalPages}
          >
            Próxima página
          </button>
        </nav>
      )}
    </section>
  )
}

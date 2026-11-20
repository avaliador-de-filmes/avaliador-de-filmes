import { Link } from 'react-router-dom'
import MediaSearch from '../../../widgets/media-search/ui/media-search'
import CatalogList from '../../../widgets/catalog-list/ui/catalog-list'
import { useAuthSession } from '../../../shared/lib/use-auth-session'

export default function CatalogPage() {
  const { userId, isLoading, isAuthenticated, error, reload } = useAuthSession()

  return (
    <main className="catalog-page">
      <header className="page-header">
        <p className="eyebrow">Catálogo pessoal</p>
        <h1>Meu catálogo</h1>
        <p>
          Busque filmes e séries, salve no catálogo e acompanhe o status de
          acompanhamento.
        </p>
        <p className="back-link">
          <Link to="/">Voltar para o início</Link>
        </p>
      </header>

      <MediaSearch />

      {isLoading && <p role="status">Carregando sessão...</p>}

      {error && (
        <div className="feedback feedback--error" role="alert">
          <p>
            Não foi possível carregar a sessão:{' '}
            {error.message ?? 'erro desconhecido.'}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      )}

      {!isLoading && !error && isAuthenticated && <CatalogList userId={userId} />}

      {!isLoading && !error && !isAuthenticated && (
        <p className="feedback">
          Entre para visualizar e salvar mídias no seu catálogo pessoal.
        </p>
      )}
    </main>
  )
}

import { Suspense } from 'react'
import { createBrowserRouter, Link, useRouteError } from 'react-router-dom'
import CatalogPage from '../../pages/catalog-page/ui/catalog-page'
import MediaDetailsPage from '../../pages/media-details-page/ui/media-details-page'
import PublicMediaPage from '../../pages/public-media-page/ui/public-media-page'

export const routePaths = {
  home: '/',
  catalog: '/catalog',
  mediaDetails: '/media/:mediaId',
  publicMedia: '/public/media/:mediaId',
}

function RouteLoadingFallback() {
  return <p role="status">Carregando página...</p>
}

function HomePage() {
  return (
    <main className="home-page">
      <h1>Avaliador de Filmes</h1>
      <p>
        Base da aplicação pronta. Busque filmes e séries, salve no catálogo
        pessoal e acompanhe o status de acompanhamento.
      </p>
      <p>
        <Link className="button" to={routePaths.catalog}>
          Ir para o catálogo
        </Link>
      </p>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main>
      <h1>Página não encontrada</h1>
      <p>A rota informada não existe.</p>
      <p>
        <Link to={routePaths.home}>Voltar para o início</Link>
      </p>
    </main>
  )
}

function RouteErrorBoundary() {
  const error = useRouteError()
  const message =
    error instanceof Error
      ? error.message
      : 'Ocorreu um erro inesperado ao carregar esta página.'

  return (
    <main role="alert">
      <h1>Não foi possível carregar esta página.</h1>
      <p>{message}</p>
    </main>
  )
}

function withPageBoundary(element) {
  return <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>
}

const routeRegistry = [
  {
    path: routePaths.home,
    element: <HomePage />,
  },
  {
    path: routePaths.catalog,
    element: <CatalogPage />,
  },
  {
    path: routePaths.mediaDetails,
    element: <MediaDetailsPage />,
  },
  {
    path: routePaths.publicMedia,
    element: <PublicMediaPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]

export const appRouter = createBrowserRouter(
  routeRegistry.map((route) => ({
    ...route,
    element: withPageBoundary(route.element),
    errorElement: <RouteErrorBoundary />,
  })),
)

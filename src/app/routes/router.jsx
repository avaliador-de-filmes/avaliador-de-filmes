import { Suspense } from 'react'
import { createBrowserRouter, useRouteError } from 'react-router-dom'

export const routePaths = {
  home: '/',
}

function RouteLoadingFallback() {
  return <p role="status">Carregando página...</p>
}

function HomePage() {
  return (
    <main>
      <h1>Avaliador de Filmes</h1>
      <p>
        Base da aplicação pronta. As rotas de catálogo, detalhes e página
        pública serão conectadas nas próximas tasks.
      </p>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main>
      <h1>Página não encontrada</h1>
      <p>A rota informada não existe.</p>
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

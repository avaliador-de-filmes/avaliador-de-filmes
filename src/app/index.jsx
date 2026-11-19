import { StrictMode } from 'react'
import { RouterProvider } from 'react-router-dom'
import { appRouter } from './routes/router'

function AppProviders({ children }) {
  return <>{children}</>
}

export default function App() {
  return (
    <StrictMode>
      <AppProviders>
        <RouterProvider
          router={appRouter}
          fallbackElement={<p role="status">Carregando aplicação...</p>}
        />
      </AppProviders>
    </StrictMode>
  )
}

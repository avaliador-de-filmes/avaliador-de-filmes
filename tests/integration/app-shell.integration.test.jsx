import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app'
import { jsonServerResources } from '../../src/shared/api/json-server/resources'
import { omdbClient } from '../../src/shared/api/omdb/client'

describe('App shell integration smoke', () => {
  it('boots providers and renders the home route', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /avaliador de filmes/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/base da aplicação pronta/i),
    ).toBeInTheDocument()
  })

  it('boots shared API adapters used by the app shell', () => {
    expect(typeof omdbClient.searchMedia).toBe('function')
    expect(typeof omdbClient.getMediaDetails).toBe('function')

    expect(typeof jsonServerResources.catalogItems.listByUser).toBe('function')
    expect(typeof jsonServerResources.ratings.listByMedia).toBe('function')
    expect(typeof jsonServerResources.reviews.listByMedia).toBe('function')
    expect(typeof jsonServerResources.media.getById).toBe('function')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CatalogList from '../../src/widgets/catalog-list/ui/catalog-list'

const USER_ID = 'u_1'

function createItem(overrides = {}) {
  return {
    id: 'ci_1',
    userId: USER_ID,
    mediaId: 'tt0133093',
    status: 'want_to_watch',
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createMedia(overrides = {}) {
  return {
    id: 'tt0133093',
    type: 'movie',
    title: 'The Matrix',
    year: '1999',
    posterUrl: 'https://example.com/matrix.jpg',
    plot: 'Um programador descobre a verdade.',
    genres: ['Action'],
    imdbRating: 8.7,
    updatedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createFakeResources({
  items = [createItem()],
  media = [createMedia()],
} = {}) {
  return {
    catalogItems: {
      listByUser: vi.fn(async () => items),
      updateStatus: vi.fn(async ({ id, status }) => ({
        id,
        status,
        updatedAt: '2026-11-20T00:00:00.000Z',
      })),
      remove: vi.fn(async () => undefined),
    },
    media: {
      listByIds: vi.fn(async () => media),
      getById: vi.fn(async () => media[0] ?? null),
      upsert: vi.fn(async (record) => record),
    },
  }
}

describe('CatalogList', () => {
  it('renders the saved items with media metadata', async () => {
    const resources = createFakeResources({
      items: [
        createItem(),
        createItem({ id: 'ci_2', mediaId: 'tt2', status: 'watching' }),
      ],
      media: [
        createMedia(),
        createMedia({ id: 'tt2', title: 'Breaking Bad', type: 'series', year: '2008–2013' }),
      ],
    })

    render(<CatalogList userId={USER_ID} resources={resources} />)

    expect(await screen.findByRole('heading', { name: 'The Matrix' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Breaking Bad' })).toBeVisible()
    expect(screen.getByText('Status atual: Quero ver')).toBeVisible()
    expect(screen.getByText('Status atual: Assistindo')).toBeVisible()
    expect(resources.media.listByIds).toHaveBeenCalledWith(['tt0133093', 'tt2'])
  })

  it('shows the empty state when the catalog has no items', async () => {
    const resources = createFakeResources({ items: [], media: [] })

    render(<CatalogList userId={USER_ID} resources={resources} />)

    expect(
      await screen.findByText(/Seu catálogo está vazio/),
    ).toBeVisible()
  })

  it('falls back to the media id when the media record is missing', async () => {
    const resources = createFakeResources({ items: [createItem()], media: [] })

    render(<CatalogList userId={USER_ID} resources={resources} />)

    expect(
      await screen.findByRole('heading', { name: 'tt0133093' }),
    ).toBeVisible()
    expect(screen.getByText(/Mídia/)).toBeVisible()
  })

  it('updates the item status and announces the result', async () => {
    const user = userEvent.setup()
    const resources = createFakeResources()

    render(<CatalogList userId={USER_ID} resources={resources} />)

    const select = await screen.findByLabelText('Status de The Matrix')
    await user.selectOptions(select, 'watching')

    expect(resources.catalogItems.updateStatus).toHaveBeenCalledWith({
      id: 'ci_1',
      status: 'watching',
    })
    expect(
      await screen.findByText('Status atual: Assistindo'),
    ).toBeVisible()
    expect(
      screen.getAllByText(
        'Status de The Matrix atualizado para Assistindo.',
      ).length,
    ).toBeGreaterThan(0)
  })

  it('reports a status update failure', async () => {
    const user = userEvent.setup()
    const resources = createFakeResources()
    resources.catalogItems.updateStatus.mockRejectedValueOnce(
      new Error('Falha ao atualizar o status.'),
    )

    render(<CatalogList userId={USER_ID} resources={resources} />)

    const select = await screen.findByLabelText('Status de The Matrix')
    await user.selectOptions(select, 'completed')

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Falha ao atualizar o status.')
    expect(screen.getByText('Status atual: Quero ver')).toBeVisible()
  })

  it('removes an item from the catalog', async () => {
    const user = userEvent.setup()
    const resources = createFakeResources()

    render(<CatalogList userId={USER_ID} resources={resources} />)

    await user.click(
      await screen.findByRole('button', {
        name: 'Remover The Matrix do catálogo',
      }),
    )

    expect(resources.catalogItems.remove).toHaveBeenCalledWith('ci_1')
    expect(
      (await screen.findAllByText('The Matrix foi removido do catálogo.')).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'The Matrix' })).toBeNull()
  })

  it('reports a removal failure and keeps the item listed', async () => {
    const user = userEvent.setup()
    const resources = createFakeResources()
    resources.catalogItems.remove.mockRejectedValueOnce(
      new Error('Não foi possível remover.'),
    )

    render(<CatalogList userId={USER_ID} resources={resources} />)

    await user.click(
      await screen.findByRole('button', {
        name: 'Remover The Matrix do catálogo',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível remover.',
    )
    expect(screen.getByRole('heading', { name: 'The Matrix' })).toBeVisible()
  })

  it('shows a load error and retries', async () => {
    const user = userEvent.setup()
    const resources = createFakeResources()
    resources.catalogItems.listByUser
      .mockRejectedValueOnce(new Error('Falha ao carregar o catálogo.'))
      .mockResolvedValueOnce([createItem()])

    render(<CatalogList userId={USER_ID} resources={resources} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao carregar o catálogo.',
    )

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(
      await screen.findByRole('heading', { name: 'The Matrix' }),
    ).toBeVisible()
    expect(resources.catalogItems.listByUser).toHaveBeenCalledTimes(2)
  })

  it('uses the default error message when the failure has no message', async () => {
    const resources = createFakeResources()
    resources.catalogItems.listByUser.mockRejectedValueOnce({})

    render(<CatalogList userId={USER_ID} resources={resources} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar o catálogo pessoal.',
      )
    })
  })
})

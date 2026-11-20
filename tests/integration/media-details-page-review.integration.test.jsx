import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaDetailsPage from '../../src/pages/media-details-page/ui/media-details-page'
import { createJsonServerClient } from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'
import { server } from '../mocks/server'

const BASE_URL = 'http://localhost:3001'
const MEDIA_ID = 'tt0133093'
const USER_ID = 'u_1'
const OTHER_USER_ID = 'u_2'
const ISO = '2026-11-18T12:00:00.000Z'

const OWN_CONTENT = 'Resenha própria publicada com detalhes suficientes.'
const EDITED_CONTENT = 'Resenha própria editada com novos detalhes válidos.'
const OTHER_CONTENT = 'Resenha pública de outra pessoa sobre esta obra.'

const MEDIA = {
  id: MEDIA_ID,
  title: 'Matrix',
  type: 'movie',
  year: 1999,
  posterUrl: null,
  imdbRating: '8.7',
  genres: ['Ação', 'Ficção científica'],
  plot: 'Um programador descobre a verdade sobre sua realidade.',
}

function createDb() {
  return {
    users: [
      {
        id: USER_ID,
        username: 'cinefilo',
        displayName: 'Cinefilo Teste',
        avatarUrl: null,
        createdAt: ISO,
      },
      {
        id: OTHER_USER_ID,
        username: 'maria',
        displayName: 'Maria Souza',
        avatarUrl: null,
        createdAt: ISO,
      },
    ],
    reviews: [
      {
        id: 'rv_other',
        userId: OTHER_USER_ID,
        mediaId: MEDIA_ID,
        content: OTHER_CONTENT,
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
    ],
    media: [],
    catalogItems: [],
  }
}

function createHandlers(db, options = {}) {
  return [
    http.get(`${BASE_URL}/users/:id`, ({ params }) => {
      const found = db.users.find((user) => user.id === params.id)

      if (!found) {
        return HttpResponse.json(
          { message: 'Usuário não encontrado.' },
          { status: 404 },
        )
      }

      return HttpResponse.json(found)
    }),

    http.get(`${BASE_URL}/catalogItems`, () => HttpResponse.json([])),

    http.get(`${BASE_URL}/media/:id`, ({ params }) => {
      const media = db.media.find((entry) => entry.id === params.id)

      if (!media) {
        return HttpResponse.json(
          { message: 'Mídia não encontrada.' },
          { status: 404 },
        )
      }

      return HttpResponse.json(media)
    }),

    http.get(`${BASE_URL}/media`, () => HttpResponse.json(db.media)),

    http.get(`${BASE_URL}/reviews`, ({ request }) => {
      const url = new URL(request.url)
      const filters = Object.fromEntries(url.searchParams.entries())

      if (filters.userId && options.failOwnReview) {
        return HttpResponse.json(
          { message: 'Erro ao carregar sua resenha.' },
          { status: 500 },
        )
      }

      const reviews = db.reviews.filter((review) =>
        Object.entries(filters).every(
          ([key, value]) => String(review[key]) === value,
        ),
      )

      return HttpResponse.json(reviews)
    }),

    http.post(`${BASE_URL}/reviews`, async ({ request }) => {
      const payload = await request.json()
      const review = {
        id: `rv_${db.reviews.length + 1}`,
        userId: payload.userId,
        mediaId: payload.mediaId,
        content: payload.content,
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      }

      db.reviews.push(review)
      return HttpResponse.json(review, { status: 201 })
    }),

    http.patch(`${BASE_URL}/reviews/:id`, async ({ request, params }) => {
      const patch = await request.json()
      const review = db.reviews.find((entry) => entry.id === params.id)

      if (!review) {
        return HttpResponse.json(
          { message: 'Resenha não encontrada.' },
          { status: 404 },
        )
      }

      Object.assign(review, patch)
      return HttpResponse.json(review)
    }),

    http.delete(`${BASE_URL}/reviews/:id`, ({ params }) => {
      db.reviews = db.reviews.filter((entry) => entry.id !== params.id)
      return HttpResponse.json({}, { status: 200 })
    }),
  ]
}

function createOmdbClient() {
  return {
    getMediaDetails: vi.fn().mockResolvedValue(MEDIA),
  }
}

describe('MediaDetailsPage review integration', () => {
  let db
  let resources

  beforeEach(() => {
    window.localStorage.clear()
    db = createDb()
    resources = createJsonServerResources(
      createJsonServerClient({ baseUrl: BASE_URL }),
    )
    server.use(...createHandlers(db))
  })

  function renderPage(omdbClient = createOmdbClient()) {
    return render(
      <MemoryRouter initialEntries={[`/media/${MEDIA_ID}`]}>
        <Routes>
          <Route
            path="/media/:mediaId"
            element={
              <MediaDetailsPage
                omdbClient={omdbClient}
                resources={resources}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
  }

  function ownReviews() {
    return db.reviews.filter((review) => review.userId === USER_ID)
  }

  function publicReviewsList() {
    return screen.getByRole('list')
  }

  it('publica, edita e exclui a própria resenha refletindo na área pública', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'Matrix' })
    expect(await screen.findByText(OTHER_CONTENT)).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()

    const textarea = await screen.findByRole('textbox', {
      name: /sua resenha/i,
    })
    await user.type(textarea, OWN_CONTENT)
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText('Resenha publicada com sucesso.', {
        selector: 'p',
      }),
    ).toBeInTheDocument()

    const editTextarea = await screen.findByRole('textbox', {
      name: /editar sua resenha/i,
    })

    expect(editTextarea).toHaveValue(OWN_CONTENT)
    await waitFor(() =>
      expect(
        within(publicReviewsList()).getByText(OWN_CONTENT),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText(/sua resenha ·/i)).toBeInTheDocument()

    // A listagem pública reflete autoria do próprio usuário e ações de mutação.
    expect(
      screen.getAllByText('Cinefilo Teste').length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('button', { name: /editar resenha/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /excluir resenha/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /editar resenha/i }))

    expect(
      await screen.findByText(/editando sua resenha/i, { selector: 'p' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /editar sua resenha/i }),
    ).toHaveFocus()

    const activeTextarea = screen.getByRole('textbox', {
      name: /editar sua resenha/i,
    })
    await user.clear(activeTextarea)
    await user.type(activeTextarea, EDITED_CONTENT)
    await user.click(
      screen.getByRole('button', { name: /salvar alterações/i }),
    )

    expect(
      await screen.findByText('Resenha atualizada com sucesso.', {
        selector: 'p',
      }),
    ).toBeInTheDocument()

    await waitFor(() =>
      expect(
        within(publicReviewsList()).getByText(EDITED_CONTENT),
      ).toBeInTheDocument(),
    )
    expect(ownReviews()).toHaveLength(1)
    expect(ownReviews()[0]).toMatchObject({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: EDITED_CONTENT,
      isDeleted: false,
    })

    await user.click(screen.getByRole('button', { name: /excluir resenha/i }))

    const dialog = screen.getByRole('alertdialog', {
      name: /excluir sua resenha/i,
    })
    expect(dialog).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(
      screen.queryByRole('alertdialog', { name: /excluir sua resenha/i }),
    ).not.toBeInTheDocument()
    expect(ownReviews()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /excluir resenha/i }))
    await user.click(
      screen.getByRole('button', { name: /confirmar exclusão/i }),
    )

    expect(
      await screen.findByText('Resenha excluída com sucesso.', {
        selector: 'p',
      }),
    ).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.queryByText(EDITED_CONTENT)).not.toBeInTheDocument(),
    )

    expect(ownReviews()).toHaveLength(1)
    expect(ownReviews()[0].isDeleted).toBe(true)

    const createTextarea = await screen.findByRole('textbox', {
      name: /sua resenha/i,
    })
    expect(createTextarea).toHaveValue('')
    expect(screen.queryByText(/sua resenha ·/i)).not.toBeInTheDocument()
  })

  it('mantém visitante em modo somente leitura na página da mídia', async () => {
    window.localStorage.setItem('avaliador.auth-session.mode', 'visitor')

    const { container } = renderPage()

    await screen.findByRole('heading', { name: 'Matrix' })
    expect(await screen.findByText(OTHER_CONTENT)).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()

    expect(
      screen.getByText('Entre para publicar uma resenha.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /publicar resenha/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /editar resenha/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /excluir resenha/i }),
    ).not.toBeInTheDocument()

    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })

  it('exibe erro ao carregar a própria resenha e permite tentar novamente', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.get(`${BASE_URL}/reviews`, ({ request }) => {
        const url = new URL(request.url)

        if (shouldFail && url.searchParams.get('userId')) {
          return HttpResponse.json(
            { message: 'Erro ao carregar sua resenha.' },
            { status: 500 },
          )
        }

        const filters = Object.fromEntries(url.searchParams.entries())
        const reviews = db.reviews.filter((review) =>
          Object.entries(filters).every(
            ([key, value]) => String(review[key]) === value,
          ),
        )

        return HttpResponse.json(reviews)
      }),
    )

    renderPage()

    await screen.findByRole('heading', { name: 'Matrix' })
    expect(
      await screen.findByText('Erro ao carregar sua resenha.'),
    ).toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(
      await screen.findByRole('textbox', { name: /sua resenha/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Erro ao carregar sua resenha.'),
    ).not.toBeInTheDocument()
  })

  it('usa os dados locais quando a OMDb está indisponível', async () => {
    db.media.push({ ...MEDIA })

    const omdbClient = {
      getMediaDetails: vi
        .fn()
        .mockRejectedValue(new Error('OMDb fora do ar.')),
    }

    renderPage(omdbClient)

    expect(
      await screen.findByText(/não foi possível consultar a omdb/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Matrix' }),
    ).toBeInTheDocument()
  })

  it('exibe erro da OMDb sem dados locais e permite tentar novamente', async () => {
    const user = userEvent.setup()
    const omdbClient = {
      getMediaDetails: vi
        .fn()
        .mockRejectedValueOnce(new Error('Falha na OMDb.'))
        .mockResolvedValue(MEDIA),
    }

    renderPage(omdbClient)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na OMDb.',
    )

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(
      await screen.findByRole('heading', { name: 'Matrix' }),
    ).toBeInTheDocument()
    expect(omdbClient.getMediaDetails).toHaveBeenCalledTimes(2)
  })

  it('exibe erro ao falhar a exclusão e mantém a confirmação aberta', async () => {
    const user = userEvent.setup()

    db.reviews.push({
      id: 'rv_own',
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: OWN_CONTENT,
      isDeleted: false,
      createdAt: ISO,
      updatedAt: ISO,
      publishedAt: ISO,
    })

    server.use(
      http.patch(`${BASE_URL}/reviews/:id`, () =>
        HttpResponse.json(
          { message: 'Falha ao excluir resenha.' },
          { status: 500 },
        ),
      ),
    )

    renderPage()

    await screen.findByRole('heading', { name: 'Matrix' })
    await screen.findByRole('textbox', { name: /editar sua resenha/i })
    await screen.findByRole('button', { name: /excluir resenha/i })

    await user.click(screen.getByRole('button', { name: /excluir resenha/i }))
    await user.click(
      screen.getByRole('button', { name: /confirmar exclusão/i }),
    )

    expect(
      await screen.findByText('Falha ao excluir resenha.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('alertdialog', { name: /excluir sua resenha/i }),
    ).toBeInTheDocument()
    expect(ownReviews()).toHaveLength(1)
  })

  it('exibe erro de sessão e permite recarregar a sessão', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.get(`${BASE_URL}/users/:id`, () => {
        if (shouldFail) {
          return HttpResponse.json(
            { message: 'Erro de sessão.' },
            { status: 500 },
          )
        }

        return HttpResponse.json(db.users[0])
      }),
    )

    renderPage()

    await screen.findByRole('heading', { name: 'Matrix' })
    expect(
      await screen.findByText(/não foi possível carregar a sessão/i),
    ).toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(
      await screen.findByRole('textbox', { name: /sua resenha/i }),
    ).toBeInTheDocument()
  })
})

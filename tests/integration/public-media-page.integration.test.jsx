import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicMediaPage from '../../src/pages/public-media-page/ui/public-media-page'
import { createJsonServerClient } from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'
import { server } from '../mocks/server'

const BASE_URL = 'http://localhost:3001'
const MEDIA_ID = 'tt0133093'
const ISO = '2026-11-18T12:00:00.000Z'

const MEDIA = {
  id: MEDIA_ID,
  title: 'Matrix',
  type: 'movie',
  year: '1999',
  posterUrl: 'https://example.com/matrix.jpg',
  imdbRating: '8.7',
  genres: ['Ação', 'Ficção científica'],
  plot: 'Um programador descobre a verdade sobre sua realidade.',
  updatedAt: ISO,
}

const REVIEW_CONTENT = 'Resenha pública de outra pessoa sobre a mesma obra.'
const DELETED_REVIEW_CONTENT =
  'Resenha removida que não deve aparecer publicamente.'

function createDb() {
  return {
    users: [
      {
        id: 'u_1',
        username: 'cinefilo',
        displayName: 'Cinefilo Teste',
        avatarUrl: null,
        createdAt: ISO,
      },
      {
        id: 'u_2',
        username: 'maria',
        displayName: 'Maria Souza',
        avatarUrl: null,
        createdAt: ISO,
      },
    ],
    ratings: [
      { id: 'ra_1', userId: 'u_1', mediaId: MEDIA_ID, value: 5, updatedAt: ISO },
      { id: 'ra_2', userId: 'u_2', mediaId: MEDIA_ID, value: 4, updatedAt: ISO },
      {
        id: 'ra_other',
        userId: 'u_2',
        mediaId: 'tt0903747',
        value: 1,
        updatedAt: ISO,
      },
    ],
    reviews: [
      {
        id: 'rv_1',
        userId: 'u_2',
        mediaId: MEDIA_ID,
        content: REVIEW_CONTENT,
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
      {
        id: 'rv_deleted',
        userId: 'u_1',
        mediaId: MEDIA_ID,
        content: DELETED_REVIEW_CONTENT,
        isDeleted: true,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
    ],
    media: [],
  }
}

function createHandlers(db, options = {}) {
  function filterByQuery(collection, request) {
    const filters = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    )

    return collection.filter((item) =>
      Object.entries(filters).every(
        ([key, value]) => String(item[key]) === value,
      ),
    )
  }

  return [
    http.get(`${BASE_URL}/ratings`, ({ request }) => {
      if (options.failRatings) {
        return HttpResponse.json(
          { message: 'Erro ao carregar avaliações.' },
          { status: 500 },
        )
      }

      return HttpResponse.json(filterByQuery(db.ratings, request))
    }),

    http.get(`${BASE_URL}/users/:id`, ({ params }) => {
      const user = db.users.find((entry) => entry.id === params.id)

      if (!user) {
        return HttpResponse.json(
          { message: 'Usuário não encontrado.' },
          { status: 404 },
        )
      }

      return HttpResponse.json(user)
    }),

    http.get(`${BASE_URL}/reviews`, ({ request }) =>
      HttpResponse.json(filterByQuery(db.reviews, request)),
    ),

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
  ]
}

function createOmdbClient() {
  return {
    getMediaDetails: vi.fn().mockResolvedValue(MEDIA),
  }
}

describe('PublicMediaPage integration', () => {
  let db
  let resources
  let requestOptions

  beforeEach(() => {
    window.localStorage.clear()
    db = createDb()
    requestOptions = {}
    resources = createJsonServerResources(
      createJsonServerClient({ baseUrl: BASE_URL }),
    )
    server.use(...createHandlers(db, requestOptions))
  })

  function renderPage(omdbClient = createOmdbClient()) {
    return render(
      <MemoryRouter initialEntries={[`/public/media/${MEDIA_ID}`]}>
        <Routes>
          <Route
            path="/public/media/:mediaId"
            element={
              <PublicMediaPage
                omdbClient={omdbClient}
                resources={resources}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('exibe mídia, avaliações e resenhas públicas sem controles de mutação', async () => {
    const { container } = renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Matrix' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /capa de matrix/i }),
    ).toHaveAttribute('src', MEDIA.posterUrl)
    expect(screen.getByText(/1999 · IMDb 8.7/)).toBeInTheDocument()
    await screen.findByText('4,5')
    expect(
      screen.getByRole('region', { name: 'Avaliações públicas' }),
    ).toHaveTextContent(/nota média: 4,5 · 2 avaliações/i)
    expect(screen.getByText('Cinefilo Teste')).toBeInTheDocument()
    expect(await screen.findByText(REVIEW_CONTENT)).toBeInTheDocument()
    expect(screen.getAllByText('Maria Souza')).toHaveLength(2)
    expect(screen.queryByText(DELETED_REVIEW_CONTENT)).not.toBeInTheDocument()

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na OMDb.')
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(
      await screen.findByRole('heading', { name: 'Matrix' }),
    ).toBeInTheDocument()
    expect(omdbClient.getMediaDetails).toHaveBeenCalledTimes(2)
  })

  it('exibe erro ao carregar avaliações e permite tentar novamente', async () => {
    const user = userEvent.setup()
    requestOptions.failRatings = true

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Erro ao carregar avaliações.',
    )

    requestOptions.failRatings = false
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await screen.findByText('4,5')
    expect(
      screen.getByRole('region', { name: 'Avaliações públicas' }),
    ).toHaveTextContent(/nota média: 4,5 · 2 avaliações/i)
    expect(screen.getByText('Cinefilo Teste')).toBeInTheDocument()
  })
})

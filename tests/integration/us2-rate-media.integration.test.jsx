import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/server'

const BASE_URL = 'http://localhost:3001'
const MEDIA_ID = 'tt0133093'
const USER_ID = 'u_1'

let MediaDetailsPage
let createJsonServerClient
let createJsonServerResources

beforeAll(async () => {
  // Importação dinâmica: os singletons de API capturam o fetch no carregamento
  // do módulo, então precisam ser criados depois que o MSW já iniciou.
  ;({ default: MediaDetailsPage } = await import(
    '../../src/pages/media-details-page/ui/media-details-page'
  ))
  ;({ createJsonServerClient } = await import(
    '../../src/shared/api/json-server/client'
  ))
  ;({ createJsonServerResources } = await import(
    '../../src/shared/api/json-server/resources'
  ))
})

afterAll(() => {
  MediaDetailsPage = null
  createJsonServerClient = null
  createJsonServerResources = null
})

function createDb() {
  return {
    users: [
      {
        id: USER_ID,
        username: 'cinefilo',
        displayName: 'Usuário Teste',
        avatarUrl: null,
        createdAt: '2026-11-18T12:00:00.000Z',
      },
    ],
    media: [
      {
        id: MEDIA_ID,
        type: 'movie',
        title: 'The Matrix',
        year: '1999',
        posterUrl: null,
        plot: 'Um hacker descobre a verdade sobre a realidade.',
        genres: ['Action', 'Sci-Fi'],
        imdbRating: 8.7,
        updatedAt: '2026-11-18T12:00:00.000Z',
      },
    ],
    catalogItems: [
      {
        id: 'ci_1',
        userId: USER_ID,
        mediaId: MEDIA_ID,
        status: 'watching',
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:10:00.000Z',
      },
    ],
    ratings: [
      {
        id: 'ra_other',
        userId: 'u_2',
        mediaId: MEDIA_ID,
        value: 5,
        createdAt: '2026-11-18T12:20:00.000Z',
        updatedAt: '2026-11-18T12:20:00.000Z',
      },
    ],
  }
}

function createHandlers(db) {
  return [
    http.get(`${BASE_URL}/users/:id`, ({ params }) => {
      const user = db.users.find((entry) => entry.id === params.id)
      return user
        ? HttpResponse.json(user)
        : HttpResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 })
    }),

    http.get(`${BASE_URL}/catalogItems`, ({ request }) => {
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      const mediaId = url.searchParams.get('mediaId')

      const items = db.catalogItems.filter((item) => {
        if (userId && item.userId !== userId) {
          return false
        }
        if (mediaId && item.mediaId !== mediaId) {
          return false
        }
        return true
      })

      return HttpResponse.json(items)
    }),

    http.get(`${BASE_URL}/media/:id`, ({ params }) => {
      const media = db.media.find((entry) => entry.id === params.id)
      return media
        ? HttpResponse.json(media)
        : HttpResponse.json({ message: 'Mídia não encontrada.' }, { status: 404 })
    }),

    http.patch(`${BASE_URL}/media/:id`, async ({ request, params }) => {
      const patch = await request.json()
      const media = db.media.find((entry) => entry.id === params.id)
      Object.assign(media, patch)
      return HttpResponse.json(media)
    }),

    http.get(`${BASE_URL}/ratings`, ({ request }) => {
      const url = new URL(request.url)
      const mediaId = url.searchParams.get('mediaId')
      const userId = url.searchParams.get('userId')

      const items = db.ratings.filter((rating) => {
        if (mediaId && rating.mediaId !== mediaId) {
          return false
        }
        if (userId && rating.userId !== userId) {
          return false
        }
        return true
      })

      return HttpResponse.json(items)
    }),

    http.post(`${BASE_URL}/ratings`, async ({ request }) => {
      const payload = await request.json()

      if (!Number.isInteger(payload.value) || payload.value < 1 || payload.value > 5) {
        return HttpResponse.json(
          {
            message: 'A nota deve ser um inteiro entre 1 e 5.',
            details: { field: 'value' },
          },
          { status: 422 },
        )
      }

      const duplicate = db.ratings.some(
        (rating) =>
          rating.userId === payload.userId && rating.mediaId === payload.mediaId,
      )

      if (duplicate) {
        return HttpResponse.json(
          {
            message: 'Já existe uma nota ativa para este usuário e mídia.',
            details: { field: 'userId' },
          },
          { status: 409 },
        )
      }

      const rating = {
        id: `ra_${db.ratings.length + 1}`,
        ...payload,
      }
      db.ratings.push(rating)

      return HttpResponse.json(rating, { status: 201 })
    }),

    http.patch(`${BASE_URL}/ratings/:id`, async ({ request, params }) => {
      const patch = await request.json()
      const rating = db.ratings.find((entry) => entry.id === params.id)

      if (!rating) {
        return HttpResponse.json(
          { message: 'Nota não encontrada.' },
          { status: 404 },
        )
      }

      Object.assign(rating, patch)
      return HttpResponse.json(rating)
    }),
  ]
}

function createOmdbStub() {
  return {
    getMediaDetails: vi.fn().mockResolvedValue({
      id: MEDIA_ID,
      type: 'movie',
      title: 'The Matrix',
      year: '1999',
      posterUrl: null,
      plot: 'Um hacker descobre a verdade sobre a realidade.',
      genres: ['Action', 'Sci-Fi'],
      imdbRating: 8.7,
      updatedAt: '2026-11-18T12:00:00.000Z',
    }),
    searchMedia: vi.fn(),
  }
}

function renderMediaDetailsPage({ omdbClient, resources }) {
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={[`/media/${MEDIA_ID}`]}>
      <Routes>
        <Route
          path="/media/:mediaId"
          element={
            <MediaDetailsPage omdbClient={omdbClient} resources={resources} />
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  return user
}

// Contrato de acessibilidade que T040–T044 devem atender:
// - editor com role="group" e nome acessível contendo "avalie"/"avaliar"/"nota";
// - opções de nota como botões nomeados "Nota 1" ... "Nota 5";
// - resumo textual com "Média X" e a quantidade de avaliações.
async function getRatingEditor() {
  return screen.findByRole('group', { name: /avalie|avaliar|sua nota|nota/i })
}

describe('US2 — integração do fluxo de avaliação em mídia salva', () => {
  let db
  let resources

  beforeEach(() => {
    localStorage.clear()
    db = createDb()
    server.use(...createHandlers(db))

    const client = createJsonServerClient({ baseUrl: BASE_URL })
    resources = createJsonServerResources(client)
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('cria e edita a nota de uma mídia já salva, atualizando média e quantidade', async () => {
    const user = renderMediaDetailsPage({
      omdbClient: createOmdbStub(),
      resources,
    })

    expect(
      await screen.findByRole('heading', { name: 'The Matrix' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/média 5/i)).toBeInTheDocument()

    const editor = await getRatingEditor()
    await user.click(within(editor).getByRole('button', { name: /^nota 4$/i }))

    expect(await screen.findByText(/média 4[.,]5/i)).toBeInTheDocument()
    expect(
      db.ratings.find(
        (rating) => rating.userId === USER_ID && rating.mediaId === MEDIA_ID,
      ),
    ).toMatchObject({ value: 4 })

    await user.click(
      within(await getRatingEditor()).getByRole('button', { name: /^nota 2$/i }),
    )

    expect(await screen.findByText(/média 3[.,]5/i)).toBeInTheDocument()
    expect(
      db.ratings.filter(
        (rating) => rating.userId === USER_ID && rating.mediaId === MEDIA_ID,
      ),
    ).toHaveLength(1)
    expect(
      db.ratings.find(
        (rating) => rating.userId === USER_ID && rating.mediaId === MEDIA_ID,
      ),
    ).toMatchObject({ value: 2 })
  })
})

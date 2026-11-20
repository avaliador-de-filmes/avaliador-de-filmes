import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJsonServerClient } from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'
import PublicReviews from '../../src/widgets/public-reviews/ui/public-reviews'
import { server } from '../mocks/server'

const BASE_URL = 'http://localhost:3001'
const MEDIA_ID = 'tt0133093'
const ISO = '2026-11-18T12:00:00.000Z'

const OWN_REVIEW_CONTENT =
  'Minha resenha pública sobre a obra com detalhes suficientes.'
const OTHER_REVIEW_CONTENT =
  'Resenha pública de outra pessoa sobre a mesma obra.'
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
      {
        id: 'u_3',
        username: 'removida',
        displayName: 'Usuário Removido',
        avatarUrl: null,
        createdAt: ISO,
      },
    ],
    reviews: [
      {
        id: 'rv_1',
        userId: 'u_1',
        mediaId: MEDIA_ID,
        content: OWN_REVIEW_CONTENT,
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
      {
        id: 'rv_2',
        userId: 'u_2',
        mediaId: MEDIA_ID,
        content: OTHER_REVIEW_CONTENT,
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
      {
        id: 'rv_3',
        userId: 'u_1',
        mediaId: MEDIA_ID,
        content: 'Resenha editada posteriormente pelo autor original.',
        isDeleted: false,
        createdAt: '2026-11-19T09:00:00.000Z',
        updatedAt: '2026-11-20T10:30:00.000Z',
        publishedAt: '2026-11-19T09:00:00.000Z',
      },
      {
        id: 'rv_deleted',
        userId: 'u_3',
        mediaId: MEDIA_ID,
        content: DELETED_REVIEW_CONTENT,
        isDeleted: true,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
      {
        id: 'rv_other_media',
        userId: 'u_2',
        mediaId: 'tt0903747',
        content: 'Resenha de outra mídia que não deve aparecer aqui.',
        isDeleted: false,
        createdAt: ISO,
        updatedAt: ISO,
        publishedAt: ISO,
      },
    ],
  }
}

function createHandlers(db) {
  return [
    http.get(`${BASE_URL}/reviews`, ({ request }) => {
      const url = new URL(request.url)
      const filters = Object.fromEntries(url.searchParams.entries())
      const reviews = db.reviews.filter((review) =>
        Object.entries(filters).every(
          ([key, value]) => String(review[key]) === value,
        ),
      )

      return HttpResponse.json(reviews)
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
  ]
}

describe('PublicReviews widget integration', () => {
  let db
  let resources

  beforeEach(() => {
    db = createDb()
    server.use(...createHandlers(db))
    resources = createJsonServerResources(
      createJsonServerClient({ baseUrl: BASE_URL }),
    )
  })

  it('lista apenas resenhas públicas com autoria, data e indicação de edição', async () => {
    render(<PublicReviews mediaId={MEDIA_ID} resources={resources} />)

    expect(
      await screen.findByText('Maria Souza'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Cinefilo Teste')).toHaveLength(2)
    expect(screen.getByText(OWN_REVIEW_CONTENT)).toBeInTheDocument()
    expect(screen.getByText(OTHER_REVIEW_CONTENT)).toBeInTheDocument()
    expect(screen.queryByText(DELETED_REVIEW_CONTENT)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/resenha de outra mídia que não deve aparecer/i),
    ).not.toBeInTheDocument()

    expect(
      screen.getAllByText(/publicada em 18\/11\/2026/i).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/editada em 20\/11\/2026/i)).toBeInTheDocument()

    // Visitante: nenhuma ação de mutação é exibida.
    expect(
      screen.queryByRole('button', { name: /editar resenha/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /excluir resenha/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/sua resenha/i)).not.toBeInTheDocument()
  })

  it('exibe ações apenas para a resenha do autor autenticado e delega callbacks', async () => {
    const user = userEvent.setup()
    const onEditReview = vi.fn()
    const onDeleteReview = vi.fn()

    render(
      <PublicReviews
        mediaId={MEDIA_ID}
        currentUserId="u_1"
        isAuthenticated
        resources={resources}
        onEditReview={onEditReview}
        onDeleteReview={onDeleteReview}
      />,
    )

    await screen.findByText('Maria Souza')

    expect(screen.getAllByText(/sua resenha/i)).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: /editar resenha/i }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: /excluir resenha/i }),
    ).toHaveLength(2)

    await user.click(
      screen.getAllByRole('button', { name: /editar resenha/i })[0],
    )

    expect(onEditReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rv_1', userId: 'u_1' }),
    )

    await user.click(
      screen.getAllByRole('button', { name: /excluir resenha/i })[0],
    )

    expect(onDeleteReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rv_1', userId: 'u_1' }),
    )
  })

  it('não exibe ações de mutação para visitante mesmo com callbacks', async () => {
    render(
      <PublicReviews
        mediaId={MEDIA_ID}
        resources={resources}
        onEditReview={vi.fn()}
        onDeleteReview={vi.fn()}
      />,
    )

    await screen.findByText('Maria Souza')

    expect(
      screen.queryByRole('button', { name: /editar resenha/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /excluir resenha/i }),
    ).not.toBeInTheDocument()
  })

  it('exibe estado vazio quando só há resenhas removidas', async () => {
    db.reviews = db.reviews.filter((review) => review.isDeleted)

    render(<PublicReviews mediaId={MEDIA_ID} resources={resources} />)

    expect(
      await screen.findByText(/ainda não há resenhas públicas/i),
    ).toBeInTheDocument()
  })

  it('exibe erro de carregamento e permite tentar novamente', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.get(`${BASE_URL}/reviews`, ({ request }) => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.error()
        }

        const url = new URL(request.url)
        const reviews = db.reviews.filter(
          (review) =>
            String(review.mediaId) === String(url.searchParams.get('mediaId')),
        )

        return HttpResponse.json(reviews)
      }),
    )

    render(<PublicReviews mediaId={MEDIA_ID} resources={resources} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível se conectar ao json server/i,
    )

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(await screen.findByText('Maria Souza')).toBeInTheDocument()
  })

  it('usa o identificador do autor quando a consulta de usuários falha', async () => {
    server.use(
      http.get(`${BASE_URL}/users/:id`, () =>
        HttpResponse.json({ message: 'Falha interna.' }, { status: 500 }),
      ),
    )

    render(<PublicReviews mediaId={MEDIA_ID} resources={resources} />)

    expect(await screen.findAllByText('u_1')).toHaveLength(2)
    expect(screen.getByText('u_2')).toBeInTheDocument()
    expect(screen.getByText(OWN_REVIEW_CONTENT)).toBeInTheDocument()
  })

  it('atualiza a listagem quando refreshToken muda', async () => {
    const { rerender } = render(
      <PublicReviews mediaId={MEDIA_ID} resources={resources} />,
    )

    await screen.findByText('Maria Souza')

    db.reviews.push({
      id: 'rv_new',
      userId: 'u_2',
      mediaId: MEDIA_ID,
      content: 'Resenha adicionada depois da primeira carga da lista.',
      isDeleted: false,
      createdAt: ISO,
      updatedAt: ISO,
      publishedAt: ISO,
    })

    rerender(
      <PublicReviews
        mediaId={MEDIA_ID}
        resources={resources}
        refreshToken={1}
      />,
    )

    expect(
      await screen.findByText(
        'Resenha adicionada depois da primeira carga da lista.',
      ),
    ).toBeInTheDocument()
  })

  it('não possui violações de acessibilidade com resenhas carregadas', async () => {
    const { container } = render(
      <PublicReviews mediaId={MEDIA_ID} resources={resources} />,
    )

    await screen.findByText('Maria Souza')

    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })
})

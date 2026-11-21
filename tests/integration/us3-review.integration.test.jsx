import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteReview,
  getActiveReview,
  listPublicReviews,
} from '../../src/features/review-media/model/review-media'
import ReviewForm from '../../src/features/review-media/ui/review-form'
import { createJsonServerClient } from '../../src/shared/api/json-server/client'
import { createJsonServerResources } from '../../src/shared/api/json-server/resources'
import { server } from '../mocks/server'

const BASE_URL = 'http://localhost:3001'
const USER_ID = 'u_1'
const MEDIA_ID = 'tt0133093'
const CONTENT = 'Primeira resenha publicada com vinte ou mais caracteres.'
const EDITED_CONTENT = 'Resenha editada com novo texto válido e mais detalhes.'
const REPUBLISHED_CONTENT = 'Resenha republicada após exclusão lógica.'

function createDb() {
  return {
    reviews: [
      {
        id: 'rv_deleted',
        userId: 'u_2',
        mediaId: MEDIA_ID,
        content: 'Resenha removida logicamente por outro usuário.',
        isDeleted: true,
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:00:00.000Z',
        publishedAt: '2026-11-18T12:00:00.000Z',
      },
    ],
  }
}

function createHandlers(db) {
  return [
    http.get(`${BASE_URL}/reviews`, ({ request }) => {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      const mediaId = url.searchParams.get('mediaId')
      const userId = url.searchParams.get('userId')

      const items = db.reviews.filter((item) => {
        if (id && item.id !== id) {
          return false
        }
        if (mediaId && item.mediaId !== mediaId) {
          return false
        }
        if (userId && item.userId !== userId) {
          return false
        }
        return true
      })

      return HttpResponse.json(items)
    }),

    http.post(`${BASE_URL}/reviews`, async ({ request }) => {
      const payload = await request.json()
      const content = typeof payload.content === 'string' ? payload.content.trim() : ''

      if (content.length < 20 || content.length > 2000) {
        return HttpResponse.json(
          {
            message: 'Review.content inválido.',
            details: { field: 'content' },
          },
          { status: 422 },
        )
      }

      const review = {
        id: `rv_${db.reviews.length + 1}`,
        ...payload,
        content,
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

/**
 * Composição mínima da página de detalhes: carrega a resenha ativa, renderiza
 * o formulário e expõe a exclusão para completar o ciclo de vida público.
 */
function ReviewLifecycleHarness({ userId, mediaId, resources }) {
  const [review, setReview] = useState(null)
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true

    getActiveReview({ userId, mediaId, resources })
      .then((activeReview) => {
        if (!active) {
          return
        }

        setReview(activeReview)
        setStatus('ready')
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setErrorMessage(
          error?.message ?? 'Não foi possível carregar a resenha.',
        )
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [userId, mediaId, resources])

  async function reloadReview() {
    const activeReview = await getActiveReview({ userId, mediaId, resources })
    setReview(activeReview)
  }

  async function handleDelete() {
    if (!review) {
      return
    }

    setActionError('')

    try {
      await deleteReview({ reviewId: review.id, userId, resources })
      await reloadReview()
    } catch (error) {
      setActionError(error?.message ?? 'Não foi possível excluir a resenha.')
    }
  }

  if (status === 'loading') {
    return <p role="status">Carregando resenha...</p>
  }

  if (status === 'error') {
    return <p role="alert">{errorMessage}</p>
  }

  return (
    <>
      <ReviewForm
        userId={userId}
        mediaId={mediaId}
        review={review}
        resources={resources}
        onPublished={reloadReview}
      />

      {review && (
        <section aria-labelledby="my-review-heading">
          <h2 id="my-review-heading">Minha resenha publicada</h2>
          <p>{review.content}</p>
          <button
            type="button"
            className="button button--danger"
            onClick={handleDelete}
          >
            Excluir resenha
          </button>
        </section>
      )}

      {actionError && (
        <p className="feedback feedback--error" role="alert">
          {actionError}
        </p>
      )}
    </>
  )
}

describe('US3 review lifecycle integration', () => {
  let db
  let resources

  beforeEach(() => {
    db = createDb()
    server.use(...createHandlers(db))
    resources = createJsonServerResources(
      createJsonServerClient({ baseUrl: BASE_URL }),
    )
  })

  function activeUserReviews() {
    return db.reviews.filter(
      (review) =>
        review.userId === USER_ID &&
        review.mediaId === MEDIA_ID &&
        !review.isDeleted,
    )
  }

  function renderHarness() {
    return render(
      <ReviewLifecycleHarness
        userId={USER_ID}
        mediaId={MEDIA_ID}
        resources={resources}
      />,
    )
  }

  it('publica, edita e exclui a resenha mantendo um único registro ativo', async () => {
    const user = userEvent.setup()
    renderHarness()

    const textarea = await screen.findByRole('textbox', {
      name: /sua resenha/i,
    })

    await user.type(textarea, CONTENT)
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText(/resenha publicada com sucesso/i, { selector: 'p' }),
    ).toBeInTheDocument()

    await screen.findByRole('heading', { name: /minha resenha publicada/i })

    expect(activeUserReviews()).toHaveLength(1)
    expect(activeUserReviews()[0]).toMatchObject({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: CONTENT,
      isDeleted: false,
    })
    expect(
      await listPublicReviews({ mediaId: MEDIA_ID, resources }),
    ).toHaveLength(1)

    const editTextarea = screen.getByRole('textbox', {
      name: /editar sua resenha/i,
    })
    await user.clear(editTextarea)
    await user.type(editTextarea, EDITED_CONTENT)
    await user.click(
      screen.getByRole('button', { name: /salvar alterações/i }),
    )

    expect(
      await screen.findByText(/resenha atualizada com sucesso/i, { selector: 'p' }),
    ).toBeInTheDocument()

    expect(activeUserReviews()).toHaveLength(1)
    expect(activeUserReviews()[0]).toMatchObject({
      content: EDITED_CONTENT,
      isDeleted: false,
    })
    expect(activeUserReviews()[0].publishedAt).toEqual(expect.any(String))

    await user.click(screen.getByRole('button', { name: /excluir resenha/i }))

    await waitFor(() => expect(activeUserReviews()).toHaveLength(0))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /minha resenha publicada/i }),
      ).not.toBeInTheDocument(),
    )

    expect(
      screen.getByRole('textbox', { name: /sua resenha/i }),
    ).toHaveValue('')
    expect(
      await listPublicReviews({ mediaId: MEDIA_ID, resources }),
    ).toHaveLength(0)

    const [softDeleted] = db.reviews.filter(
      (review) => review.userId === USER_ID,
    )
    expect(softDeleted.isDeleted).toBe(true)
  })

  it('reaproveita o registro removido ao publicar novamente, sem duplicar', async () => {
    const user = userEvent.setup()
    renderHarness()

    const textarea = await screen.findByRole('textbox', {
      name: /sua resenha/i,
    })

    await user.type(textarea, CONTENT)
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))
    await screen.findByRole('heading', { name: /minha resenha publicada/i })

    await user.click(screen.getByRole('button', { name: /excluir resenha/i }))
    await waitFor(() => expect(activeUserReviews()).toHaveLength(0))

    const [deletedReview] = db.reviews.filter(
      (review) => review.userId === USER_ID,
    )
    expect(deletedReview.isDeleted).toBe(true)

    const republishTextarea = await screen.findByRole('textbox', {
      name: /sua resenha/i,
    })
    await user.type(republishTextarea, REPUBLISHED_CONTENT)
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText(/resenha republicada com sucesso/i, { selector: 'p' }),
    ).toBeInTheDocument()

    await screen.findByRole('heading', { name: /minha resenha publicada/i })

    expect(activeUserReviews()).toHaveLength(1)
    expect(activeUserReviews()[0].id).toBe(deletedReview.id)
    expect(activeUserReviews()[0]).toMatchObject({
      content: REPUBLISHED_CONTENT,
      isDeleted: false,
    })
    expect(
      db.reviews.filter((review) => review.userId === USER_ID),
    ).toHaveLength(1)
  })
})

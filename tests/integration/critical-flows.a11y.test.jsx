import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'jest-axe'
import SaveMediaControls from '../../src/features/save-media/ui/save-media-controls'
import RatingEditor from '../../src/features/rate-media/ui/rating-editor'
import ReviewForm from '../../src/features/review-media/ui/review-form'

const USER_ID = 'u_1'
const MEDIA_ID = 'tt0133093'
const MEDIA = {
  id: MEDIA_ID,
  type: 'movie',
  title: 'The Matrix',
  year: '1999',
  posterUrl: 'https://example.com/matrix.jpg',
  plot: 'Um programador descobre a verdade.',
  genres: ['Action'],
  imdbRating: 8.7,
  updatedAt: '2026-11-18T12:00:00.000Z',
}

function createSaveResources({ existingItem = null } = {}) {
  return {
    catalogItems: {
      findByUserAndMedia: vi.fn(async () => existingItem),
      create: vi.fn(async (payload) => ({ id: 'ci_1', ...payload })),
    },
    media: {
      getById: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
    },
  }
}

function createRatingResources() {
  return {
    ratings: {
      findByUserAndMedia: vi.fn(async () => null),
      create: vi.fn(async (payload) => ({ id: 'rt_1', ...payload })),
      updateValue: vi.fn(async ({ id, value }) => ({ id, value })),
    },
  }
}

function createReviewResources() {
  return {
    reviews: {
      findByUserAndMedia: vi.fn(async () => null),
      create: vi.fn(async (payload) => ({
        id: 'rv_1',
        isDeleted: false,
        ...payload,
      })),
      update: vi.fn(async (id, patch) => ({ id, ...patch })),
    },
  }
}

function renderSaveControls(props) {
  return render(
    <MemoryRouter>
      <SaveMediaControls {...props} />
    </MemoryRouter>,
  )
}

describe('critical flows accessibility — save', () => {
  it('has no detectable violations on the save controls', async () => {
    const { container } = renderSaveControls({
      userId: USER_ID,
      media: MEDIA,
      resources: createSaveResources(),
    })

    await screen.findByRole('button', { name: 'Salvar no catálogo' })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('completes the save flow using only the keyboard', async () => {
    const user = userEvent.setup()
    const resources = createSaveResources()

    renderSaveControls({
      userId: USER_ID,
      media: MEDIA,
      resources,
    })

    const saveButton = await screen.findByRole('button', {
      name: 'Salvar no catálogo',
    })
    saveButton.focus()
    expect(saveButton).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(resources.catalogItems.create).toHaveBeenCalledWith({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      status: 'want_to_watch',
    })
    expect(
      (await screen.findAllByText('Mídia salva no catálogo com status Quero ver.'))
        .length,
    ).toBeGreaterThan(0)
  })

  it('explains the visitor restriction without violations', async () => {
    const { container } = renderSaveControls({
      userId: null,
      media: MEDIA,
      isAuthenticated: false,
      resources: createSaveResources(),
    })

    expect(
      screen.getByText('Entre para salvar esta mídia no seu catálogo pessoal.'),
    ).toBeVisible()
    expect(await axe(container)).toHaveNoViolations()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('critical flows accessibility — rate', () => {
  it('has no detectable violations on the rating editor', async () => {
    const { container } = render(
      <RatingEditor
        userId={USER_ID}
        mediaId={MEDIA_ID}
        resources={createRatingResources()}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it('navigates and confirms a rating using only the keyboard', async () => {
    const user = userEvent.setup()
    const resources = createRatingResources()

    render(
      <RatingEditor
        userId={USER_ID}
        mediaId={MEDIA_ID}
        resources={resources}
      />,
    )

    const optionThree = screen.getByRole('button', { name: 'Nota 3' })
    optionThree.focus()
    expect(optionThree).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    const optionFour = screen.getByRole('button', { name: 'Nota 4' })
    expect(optionFour).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(resources.ratings.create).toHaveBeenCalledWith({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      value: 4,
    })
    expect(await screen.findByText('Nota 4 registrada.')).toBeVisible()
    expect(optionFour).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps rating options reachable for visitors as a read-only message', async () => {
    const { container } = render(
      <RatingEditor
        userId={null}
        mediaId={MEDIA_ID}
        isAuthenticated={false}
        resources={createRatingResources()}
      />,
    )

    expect(screen.getByText('Entre para avaliar esta mídia.')).toBeVisible()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('critical flows accessibility — review', () => {
  it('has no detectable violations on the review form', async () => {
    const { container } = render(
      <ReviewForm
        userId={USER_ID}
        mediaId={MEDIA_ID}
        resources={createReviewResources()}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it('validates and publishes a review using only the keyboard', async () => {
    const user = userEvent.setup()
    const resources = createReviewResources()

    render(
      <ReviewForm
        userId={USER_ID}
        mediaId={MEDIA_ID}
        resources={resources}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Sua resenha' })
    textarea.focus()
    expect(textarea).toHaveFocus()

    await user.keyboard('resenha curta')
    await user.keyboard('{Control>}{Enter}{/Control}')

    const validationAlert = await screen.findByRole('alert')
    expect(validationAlert).toHaveTextContent(
      'A resenha deve ter pelo menos 20 caracteres.',
    )
    expect(textarea).toHaveFocus()
    expect(resources.reviews.create).not.toHaveBeenCalled()

    await user.clear(textarea)
    await user.keyboard('Uma resenha válida com mais de vinte caracteres.')
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(resources.reviews.create).toHaveBeenCalledWith({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: 'Uma resenha válida com mais de vinte caracteres.',
      publishedAt: expect.any(String),
    })
    expect(
      (await screen.findAllByText('Resenha publicada com sucesso.')).length,
    ).toBeGreaterThan(0)
  })

  it('shows a read-only message for visitors without violations', async () => {
    const { container } = render(
      <ReviewForm
        userId={null}
        mediaId={MEDIA_ID}
        isAuthenticated={false}
        resources={createReviewResources()}
      />,
    )

    expect(screen.getByText('Entre para publicar uma resenha.')).toBeVisible()
    expect(await axe(container)).toHaveNoViolations()
  })
})

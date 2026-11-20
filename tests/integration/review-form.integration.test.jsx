import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import ReviewForm from '../../src/features/review-media/ui/review-form'

const USER_ID = 'u_1'
const MEDIA_ID = 'tt0133093'
const VALID_CONTENT = 'Uma resenha válida com mais de vinte caracteres.'
const NOW = '2026-11-20T12:00:00.000Z'
const MIN_CONTENT = 'a'.repeat(20)
const MAX_CONTENT = 'b'.repeat(2000)

function createReview(overrides = {}) {
  return {
    id: 'rv_1',
    userId: USER_ID,
    mediaId: MEDIA_ID,
    content: 'Resenha original com mais de vinte caracteres.',
    isDeleted: false,
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    publishedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createResources({ existingReview = null } = {}) {
  const reviews = {
    findByUserAndMedia: vi.fn(async ({ includeDeleted = true } = {}) => {
      if (!existingReview) {
        return null
      }

      if (includeDeleted) {
        return existingReview
      }

      return existingReview.isDeleted ? null : existingReview
    }),

    list: vi.fn(async ({ id } = {}) => {
      if (!existingReview) {
        return []
      }

      return !id || existingReview.id === id ? [existingReview] : []
    }),

    create: vi.fn(async (payload) => ({
      id: 'rv_new',
      ...payload,
      isDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
      publishedAt: payload.publishedAt ?? NOW,
    })),

    update: vi.fn(async (id, patch) => ({
      ...(existingReview ?? {}),
      id,
      ...patch,
    })),

    remove: vi.fn(),

    listByMedia: vi.fn(async () => (existingReview ? [existingReview] : [])),
  }

  return { reviews }
}

function renderForm(props = {}) {
  const resources = props.resources ?? createResources()

  const view = render(
    <ReviewForm
      userId={USER_ID}
      mediaId={MEDIA_ID}
      resources={resources}
      {...props}
    />,
  )

  return { ...view, resources }
}

describe('ReviewForm', () => {
  it('rejeita resenha abaixo do limite mínimo e mantém o foco no campo', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    await user.type(textarea, 'curta')
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /pelo menos 20 caracteres/i,
    )
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea).toHaveFocus()
    expect(resources.reviews.create).not.toHaveBeenCalled()
  })

  it('rejeita resenha contendo apenas espaços', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    await user.type(textarea, '     ')
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /escreva uma resenha/i,
    )
    expect(resources.reviews.create).not.toHaveBeenCalled()
  })

  it('rejeita resenha acima do limite máximo de 2000 caracteres', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    fireEvent.change(textarea, { target: { value: 'b'.repeat(2001) } })
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no máximo 2000 caracteres/i,
    )
    expect(resources.reviews.create).not.toHaveBeenCalled()
  })

  it('publica resenha válida com conteúdo normalizado e anuncia o sucesso', async () => {
    const user = userEvent.setup()
    const onPublished = vi.fn()
    const { resources } = renderForm({ onPublished })

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    await user.type(textarea, `  ${VALID_CONTENT}  `)
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText(/resenha publicada com sucesso/i),
    ).toBeInTheDocument()
    expect(resources.reviews.create).toHaveBeenCalledWith({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      content: VALID_CONTENT,
      publishedAt: expect.any(String),
    })
    expect(onPublished).toHaveBeenCalledWith(
      expect.objectContaining({ created: true }),
    )
    expect(textarea).toHaveValue(VALID_CONTENT)
  })

  it('aceita resenha com exatamente 20 caracteres', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    fireEvent.change(textarea, { target: { value: MIN_CONTENT } })
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText(/resenha publicada com sucesso/i),
    ).toBeInTheDocument()
    expect(resources.reviews.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: MIN_CONTENT }),
    )
  })

  it('aceita resenha com exatamente 2000 caracteres', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    fireEvent.change(textarea, { target: { value: MAX_CONTENT } })
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText(/resenha publicada com sucesso/i),
    ).toBeInTheDocument()
    expect(resources.reviews.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: MAX_CONTENT }),
    )
  })

  it('envia por teclado com Ctrl+Enter', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    await user.type(textarea, VALID_CONTENT)
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(
      await screen.findByText(/resenha publicada com sucesso/i),
    ).toBeInTheDocument()
    expect(resources.reviews.create).toHaveBeenCalledTimes(1)
  })

  it('preenche e edita a resenha ativa existente', async () => {
    const user = userEvent.setup()
    const existingReview = createReview()
    const resources = createResources({ existingReview })

    renderForm({ resources, review: existingReview })

    const textarea = screen.getByRole('textbox', { name: /editar sua resenha/i })
    expect(textarea).toHaveValue(existingReview.content)

    const editedContent = 'Conteúdo editado com vinte ou mais caracteres.'
    await user.clear(textarea)
    await user.type(textarea, editedContent)
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    expect(
      await screen.findByText(/resenha atualizada com sucesso/i),
    ).toBeInTheDocument()
    expect(resources.reviews.update).toHaveBeenCalledWith(
      'rv_1',
      expect.objectContaining({ content: editedContent }),
    )
    expect(resources.reviews.create).not.toHaveBeenCalled()
  })

  it('exibe erro de servidor e permite nova tentativa', async () => {
    const user = userEvent.setup()
    const { resources } = renderForm()

    resources.reviews.create.mockRejectedValueOnce(
      new Error('Falha ao publicar resenha.'),
    )

    const textarea = screen.getByRole('textbox', { name: /sua resenha/i })
    await user.type(textarea, VALID_CONTENT)
    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao publicar resenha.',
    )

    await user.click(screen.getByRole('button', { name: /publicar resenha/i }))

    expect(
      await screen.findByText(/resenha publicada com sucesso/i),
    ).toBeInTheDocument()
    expect(resources.reviews.create).toHaveBeenCalledTimes(2)
  })

  it('não exibe o formulário para visitantes não autenticados', () => {
    renderForm({ isAuthenticated: false })

    expect(
      screen.getByText(/entre para publicar uma resenha/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /publicar resenha/i }),
    ).not.toBeInTheDocument()
  })

  it('não possui violações de acessibilidade no estado inicial', async () => {
    const { container } = renderForm()

    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import OmdbFallback from '../../src/shared/ui/omdb-fallback'
import {
  OMDB_FALLBACK_GUIDANCE,
  getOmdbFallbackGuidance,
  resolveOmdbFallbackError,
} from '../../src/shared/lib/omdb-fallback'

function createOmdbError({ kind = 'network_error', message, retryable = true }) {
  return Object.assign(new Error(message ?? 'Falha na OMDb.'), {
    name: 'OmdbClientError',
    kind,
    retryable,
  })
}

describe('resolveOmdbFallbackError', () => {
  it('uses the default message when there is no error', () => {
    expect(resolveOmdbFallbackError(null)).toEqual({
      message: 'Não foi possível consultar a OMDb no momento.',
      kind: null,
      retryable: true,
    })
  })

  it('normalizes string errors', () => {
    expect(resolveOmdbFallbackError('  timeout  ')).toEqual({
      message: 'timeout',
      kind: null,
      retryable: true,
    })
    expect(resolveOmdbFallbackError('   ').message).toBe(
      'Não foi possível consultar a OMDb no momento.',
    )
  })

  it('reads kind and retryable from adapter errors', () => {
    expect(
      resolveOmdbFallbackError(
        createOmdbError({ kind: 'rate_limited', retryable: true }),
      ),
    ).toEqual({
      message: 'Falha na OMDb.',
      kind: 'rate_limited',
      retryable: true,
    })

    expect(
      resolveOmdbFallbackError(
        createOmdbError({ kind: 'unauthorized', retryable: false }),
      ).retryable,
    ).toBe(false)
  })

  it('accepts a code instead of kind and ignores blank kinds', () => {
    expect(
      resolveOmdbFallbackError({ code: 'not_found', message: 'Nada aqui.' })
        .kind,
    ).toBe('not_found')
    expect(resolveOmdbFallbackError({ code: '   ', message: 'x' }).kind).toBeNull()
  })

  it('falls back to the default message when the error has none', () => {
    expect(resolveOmdbFallbackError({ kind: 'network_error' }).message).toBe(
      'Não foi possível consultar a OMDb no momento.',
    )
  })

  it('resolves guidance only for known kinds', () => {
    expect(getOmdbFallbackGuidance('network_error')).toBe(
      OMDB_FALLBACK_GUIDANCE.network_error,
    )
    expect(getOmdbFallbackGuidance(null)).toBeNull()
    expect(getOmdbFallbackGuidance('desconhecido')).toBeNull()
  })
})

describe('OmdbFallback', () => {
  it('renders an accessible alert with the default copy', () => {
    render(<OmdbFallback />)

    const alert = screen.getByRole('alert')

    expect(alert).toHaveAccessibleName('Falha ao consultar a OMDb')
    expect(alert).toHaveTextContent(
      'Não foi possível consultar a OMDb no momento.',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows kind-specific guidance from the OMDb error contract', () => {
    render(
      <OmdbFallback error={createOmdbError({ kind: 'rate_limited' })} />,
    )

    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-error-kind',
      'rate_limited',
    )
    expect(
      screen.getByText(OMDB_FALLBACK_GUIDANCE.rate_limited),
    ).toBeVisible()
  })

  it('shows guidance for unauthorized, not found and invalid responses', () => {
    const { rerender } = render(
      <OmdbFallback error={createOmdbError({ kind: 'unauthorized' })} />,
    )
    expect(
      screen.getByText(OMDB_FALLBACK_GUIDANCE.unauthorized),
    ).toBeVisible()

    rerender(<OmdbFallback error={createOmdbError({ kind: 'not_found' })} />)
    expect(screen.getByText(OMDB_FALLBACK_GUIDANCE.not_found)).toBeVisible()

    rerender(
      <OmdbFallback error={createOmdbError({ kind: 'invalid_response' })} />,
    )
    expect(
      screen.getByText(OMDB_FALLBACK_GUIDANCE.invalid_response),
    ).toBeVisible()
  })

  it('omits guidance when the error kind is unknown', () => {
    const { container } = render(
      <OmdbFallback error={createOmdbError({ kind: 'algo_inesperado' })} />,
    )

    expect(container.querySelector('.omdb-fallback__guidance')).toBeNull()
  })

  it('offers a retry action that calls onRetry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(<OmdbFallback error="Falha de rede." onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps the retry button disabled and announces progress while retrying', () => {
    render(<OmdbFallback error="Falha de rede." onRetry={vi.fn()} isRetrying />)

    const button = screen.getByRole('button', { name: 'Tentando novamente...' })

    expect(button).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true')
  })

  it('hides the retry action for non retryable failures', () => {
    render(
      <OmdbFallback
        error={createOmdbError({ kind: 'unauthorized', retryable: false })}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('supports custom title, labels and a local fallback notice', () => {
    render(
      <OmdbFallback
        error="Falha de rede."
        onRetry={vi.fn()}
        title="Busca indisponível"
        retryLabel="Buscar de novo"
        fallbackMessage="Exibindo dados salvos no catálogo local."
      />,
    )

    expect(screen.getByRole('alert')).toHaveAccessibleName('Busca indisponível')
    expect(screen.getByRole('button', { name: 'Buscar de novo' })).toBeVisible()
    expect(
      screen.getByText('Exibindo dados salvos no catálogo local.'),
    ).toBeVisible()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <OmdbFallback
        error={createOmdbError({ kind: 'network_error' })}
        onRetry={vi.fn()}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})

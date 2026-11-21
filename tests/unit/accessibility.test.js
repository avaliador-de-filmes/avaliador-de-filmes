import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  announceToLiveRegion,
  clearLiveRegion,
  createFocusTrap,
  ensureLiveRegion,
  focusFirstElement,
  focusLastElement,
  getFocusableElements,
  isActivationKey,
  isEscapeKey,
  isTabKey,
  onKeyboardActivate,
} from '../../src/shared/lib/accessibility'

function renderFixture(html) {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('key predicates', () => {
  it('recognizes activation keys', () => {
    expect(isActivationKey({ key: 'Enter' })).toBe(true)
    expect(isActivationKey({ key: ' ' })).toBe(true)
    expect(isActivationKey({ key: 'Spacebar' })).toBe(true)
    expect(isActivationKey({ key: 'Escape' })).toBe(false)
    expect(isActivationKey(undefined)).toBe(false)
  })

  it('recognizes escape and tab keys', () => {
    expect(isEscapeKey({ key: 'Escape' })).toBe(true)
    expect(isEscapeKey({ key: 'Enter' })).toBe(false)
    expect(isTabKey({ key: 'Tab' })).toBe(true)
    expect(isTabKey({ key: 'Enter' })).toBe(false)
  })
})

describe('onKeyboardActivate', () => {
  it('ignores keys that are not activation keys', () => {
    const callback = vi.fn()
    const event = { key: 'Escape', preventDefault: vi.fn() }

    expect(onKeyboardActivate(event, callback)).toBe(false)
    expect(callback).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('ignores invalid callbacks', () => {
    const event = { key: 'Enter', preventDefault: vi.fn() }

    expect(onKeyboardActivate(event, null)).toBe(false)
  })

  it('activates the callback and prevents the default action', () => {
    const callback = vi.fn()
    const event = {
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }

    expect(onKeyboardActivate(event, callback)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(event)
    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  it('supports disabling preventDefault and enabling stopPropagation', () => {
    const event = {
      key: ' ',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }

    onKeyboardActivate(event, vi.fn(), {
      preventDefault: false,
      stopPropagation: true,
    })

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  })
})

describe('focusable elements', () => {
  it('returns an empty list without a container', () => {
    expect(getFocusableElements(null)).toEqual([])
    expect(getFocusableElements({})).toEqual([])
  })

  it('collects enabled and visible focusable elements', () => {
    const container = renderFixture(`
      <button>Primeiro</button>
      <button disabled>Desabilitado</button>
      <a href="#destino">Link</a>
      <input />
      <textarea></textarea>
      <select><option>1</option></select>
      <div tabindex="0">Foco manual</div>
      <div tabindex="-1">Fora da ordem</div>
      <button aria-hidden="true">Oculto</button>
    `)

    const focusables = getFocusableElements(container)

    expect(focusables).toHaveLength(6)
    expect(focusables[0].textContent).toBe('Primeiro')
  })

  it('focuses the first and last elements', () => {
    const container = renderFixture(`
      <button id="first">Primeiro</button>
      <button id="last">Último</button>
    `)

    expect(focusFirstElement(container)).toBe(true)
    expect(document.activeElement.id).toBe('first')

    expect(focusLastElement(container)).toBe(true)
    expect(document.activeElement.id).toBe('last')
  })

  it('reports false when there is nothing to focus', () => {
    const container = renderFixture('<p>Sem controles</p>')

    expect(focusFirstElement(container)).toBe(false)
    expect(focusLastElement(container)).toBe(false)
  })
})

describe('createFocusTrap', () => {
  let container

  beforeEach(() => {
    container = renderFixture(`
      <button id="first">Primeiro</button>
      <button id="last">Último</button>
    `)
  })

  it('ignores non tab keys', () => {
    const handle = createFocusTrap(container)
    const event = { key: 'Enter', preventDefault: vi.fn() }

    handle(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('wraps focus forward from the last element', () => {
    const handle = createFocusTrap(container)
    document.getElementById('last').focus()
    const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() }

    handle(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement.id).toBe('first')
  })

  it('wraps focus backwards from the first element', () => {
    const handle = createFocusTrap(container)
    document.getElementById('first').focus()
    const event = { key: 'Tab', shiftKey: true, preventDefault: vi.fn() }

    handle(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement.id).toBe('last')
  })

  it('does nothing when focus is in the middle', () => {
    const middle = renderFixture('<button id="middle">Meio</button>')
    const handle = createFocusTrap(container)
    middle.querySelector('button').focus()
    const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() }

    handle(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('blocks tab navigation when there are no focusable elements', () => {
    const empty = renderFixture('<p>vazio</p>')
    const handle = createFocusTrap(empty)
    const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() }

    handle(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})

describe('live region helpers', () => {
  it('creates a single live region with the expected attributes', () => {
    const region = ensureLiveRegion('test-live-region')

    expect(region).toBeInstanceOf(HTMLElement)
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.getAttribute('aria-atomic')).toBe('true')
    expect(region.getAttribute('role')).toBe('status')
    expect(region.style.position).toBe('absolute')

    const sameRegion = ensureLiveRegion('test-live-region')
    expect(sameRegion).toBe(region)
    expect(document.querySelectorAll('#test-live-region')).toHaveLength(1)
  })

  it('honors politeness, atomic and role options', () => {
    const region = ensureLiveRegion('assertive-region', {
      politeness: 'assertive',
      atomic: false,
      role: 'alert',
    })

    expect(region.getAttribute('aria-live')).toBe('assertive')
    expect(region.getAttribute('aria-atomic')).toBe('false')
    expect(region.getAttribute('role')).toBe('alert')
  })

  it('announces trimmed messages after the configured delay', () => {
    vi.useFakeTimers()
    announceToLiveRegion('  Mídia salva.  ')

    const region = document.getElementById('app-live-region')
    expect(region.textContent).toBe('')

    vi.advanceTimersByTime(10)

    expect(region.textContent).toBe('Mídia salva.')
  })

  it('ignores empty messages', () => {
    announceToLiveRegion('   ')
    announceToLiveRegion(null)

    expect(document.getElementById('app-live-region')).toBeNull()
  })

  it('clears the live region content', () => {
    const region = ensureLiveRegion('app-live-region')
    region.textContent = 'Conteúdo antigo'

    clearLiveRegion()

    expect(region.textContent).toBe('')
  })

  it('clearing a missing region is a no-op', () => {
    expect(() => clearLiveRegion('nao-existe')).not.toThrow()
  })
})

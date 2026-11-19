const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar'])

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ')

export function isActivationKey(event) {
  return ACTIVATION_KEYS.has(event?.key)
}

export function isEscapeKey(event) {
  return event?.key === 'Escape'
}

export function isTabKey(event) {
  return event?.key === 'Tab'
}

export function onKeyboardActivate(event, callback, options = {}) {
  if (!isActivationKey(event) || typeof callback !== 'function') {
    return false
  }

  if (options.preventDefault ?? true) {
    event.preventDefault()
  }

  if (options.stopPropagation ?? false) {
    event.stopPropagation()
  }

  callback(event)
  return true
}

export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return []
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  )
}

export function focusFirstElement(container) {
  const [first] = getFocusableElements(container)
  if (!first) {
    return false
  }

  first.focus()
  return true
}

export function focusLastElement(container) {
  const focusables = getFocusableElements(container)
  const last = focusables[focusables.length - 1]

  if (!last) {
    return false
  }

  last.focus()
  return true
}

export function createFocusTrap(container) {
  return function handleFocusTrap(event) {
    if (!isTabKey(event)) {
      return
    }

    const focusables = getFocusableElements(container)
    if (!focusables.length) {
      event.preventDefault()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = typeof document !== 'undefined' ? document.activeElement : null

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
      return
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

function getLiveRegionStyles() {
  return {
    border: '0',
    clip: 'rect(0 0 0 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: '0',
    position: 'absolute',
    width: '1px',
    whiteSpace: 'nowrap',
  }
}

export function ensureLiveRegion(id = 'app-live-region', options = {}) {
  if (typeof document === 'undefined') {
    return null
  }

  const existing = document.getElementById(id)
  if (existing) {
    return existing
  }

  const region = document.createElement('div')
  region.id = id
  region.setAttribute('aria-live', options.politeness ?? 'polite')
  region.setAttribute('aria-atomic', String(options.atomic ?? true))
  region.setAttribute('role', options.role ?? 'status')

  const styles = getLiveRegionStyles()
  for (const [key, value] of Object.entries(styles)) {
    region.style[key] = value
  }

  document.body.appendChild(region)
  return region
}

export function announceToLiveRegion(message, options = {}) {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) {
    return
  }

  const region = ensureLiveRegion(options.id, options)
  if (!region) {
    return
  }

  region.textContent = ''
  setTimeout(() => {
    region.textContent = text
  }, options.delayMs ?? 10)
}

export function clearLiveRegion(id = 'app-live-region') {
  if (typeof document === 'undefined') {
    return
  }

  const region = document.getElementById(id)
  if (region) {
    region.textContent = ''
  }
}

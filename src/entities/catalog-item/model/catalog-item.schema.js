export const CATALOG_ITEM_STATUS = Object.freeze({
  wantToWatch: 'want_to_watch',
  watching: 'watching',
  completed: 'completed',
  onHold: 'on_hold',
  dropped: 'dropped',
})

const ALLOWED_STATUS = new Set(Object.values(CATALOG_ITEM_STATUS))

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function addError(errors, field, message) {
  errors.push({ field, message })
}

export function buildCatalogItemUniqueKey(item) {
  const userId = normalizeString(item?.userId)
  const mediaId = normalizeString(item?.mediaId)
  return `${userId}::${mediaId}`
}

export function validateCatalogItemSchema(payload) {
  const errors = []
  const id = normalizeString(payload?.id)
  const userId = normalizeString(payload?.userId)
  const mediaId = normalizeString(payload?.mediaId)
  const status = normalizeString(payload?.status)
  const createdAt = payload?.createdAt
  const updatedAt = payload?.updatedAt

  if (!id) {
    addError(errors, 'id', 'CatalogItem.id é obrigatório.')
  }

  if (!userId) {
    addError(errors, 'userId', 'CatalogItem.userId é obrigatório.')
  }

  if (!mediaId) {
    addError(errors, 'mediaId', 'CatalogItem.mediaId é obrigatório.')
  }

  if (!ALLOWED_STATUS.has(status)) {
    addError(errors, 'status', 'CatalogItem.status deve ser um valor permitido.')
  }

  if (!isIsoDateString(createdAt)) {
    addError(errors, 'createdAt', 'CatalogItem.createdAt deve estar em ISO-8601.')
  }

  if (!isIsoDateString(updatedAt)) {
    addError(errors, 'updatedAt', 'CatalogItem.updatedAt deve estar em ISO-8601.')
  }

  const value = errors.length
    ? null
    : {
        id,
        userId,
        mediaId,
        status,
        createdAt,
        updatedAt,
      }

  return {
    valid: errors.length === 0,
    errors,
    value,
  }
}

export function assertCatalogItemSchema(payload) {
  const result = validateCatalogItemSchema(payload)

  if (!result.valid) {
    throw new TypeError(result.errors[0]?.message ?? 'CatalogItem inválido.')
  }

  return result.value
}

export function validateCatalogItemUniqueness(items = []) {
  const activeKeys = new Set()
  const duplicatedKeys = new Set()

  for (const item of items) {
    const key = buildCatalogItemUniqueKey(item)
    if (key === '::') {
      continue
    }

    if (activeKeys.has(key)) {
      duplicatedKeys.add(key)
      continue
    }

    activeKeys.add(key)
  }

  return {
    valid: duplicatedKeys.size === 0,
    duplicatedKeys: Array.from(duplicatedKeys),
  }
}

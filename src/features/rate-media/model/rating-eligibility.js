import { buildCatalogItemUniqueKey } from '../../../entities/catalog-item/model/catalog-item.schema'

export const RATING_ELIGIBILITY_REASON = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  MISSING_SESSION: 'MISSING_SESSION',
  MISSING_MEDIA: 'MISSING_MEDIA',
  MEDIA_NOT_SAVED: 'MEDIA_NOT_SAVED',
  CATALOG_LOOKUP_FAILED: 'CATALOG_LOOKUP_FAILED',
})

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * data-model.md (CatalogItem.userId) e data-model.md (CatalogItem.mediaId):
 * o item salvo que habilita a avaliação é identificado pelo par usuário+mídia.
 */
export function isCatalogItemForUserAndMedia(item, { userId, mediaId } = {}) {
  if (!item) {
    return false
  }

  const key = buildCatalogItemUniqueKey({
    userId: normalizeString(userId),
    mediaId: normalizeString(mediaId),
  })

  return key !== '::' && buildCatalogItemUniqueKey(item) === key
}

export function findUserCatalogItem(catalogItems = [], { userId, mediaId } = {}) {
  const items = Array.isArray(catalogItems) ? catalogItems : []

  return (
    items.find((item) => isCatalogItemForUserAndMedia(item, { userId, mediaId })) ??
    null
  )
}

export function getRatingEligibility({
  isAuthenticated = false,
  userId,
  mediaId,
  catalogItems = [],
  catalogItem = null,
} = {}) {
  if (!isAuthenticated) {
    return {
      eligible: false,
      reason: RATING_ELIGIBILITY_REASON.UNAUTHENTICATED,
      catalogItem: null,
    }
  }

  if (!normalizeString(userId)) {
    return {
      eligible: false,
      reason: RATING_ELIGIBILITY_REASON.MISSING_SESSION,
      catalogItem: null,
    }
  }

  if (!normalizeString(mediaId)) {
    return {
      eligible: false,
      reason: RATING_ELIGIBILITY_REASON.MISSING_MEDIA,
      catalogItem: null,
    }
  }

  const item = catalogItem ?? findUserCatalogItem(catalogItems, { userId, mediaId })

  if (!isCatalogItemForUserAndMedia(item, { userId, mediaId })) {
    return {
      eligible: false,
      reason: RATING_ELIGIBILITY_REASON.MEDIA_NOT_SAVED,
      catalogItem: null,
    }
  }

  return { eligible: true, reason: null, catalogItem: item }
}

export function canRateMedia(options = {}) {
  return getRatingEligibility(options).eligible
}

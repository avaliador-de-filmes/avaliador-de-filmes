import { CATALOG_ITEM_STATUS } from './catalog-item.schema'

export const CATALOG_ITEM_STATUS_LABELS = Object.freeze({
  [CATALOG_ITEM_STATUS.wantToWatch]: 'Quero ver',
  [CATALOG_ITEM_STATUS.watching]: 'Assistindo',
  [CATALOG_ITEM_STATUS.completed]: 'Concluído',
  [CATALOG_ITEM_STATUS.onHold]: 'Em pausa',
  [CATALOG_ITEM_STATUS.dropped]: 'Abandonado',
})

export const CATALOG_ITEM_STATUS_OPTIONS = Object.freeze(
  Object.entries(CATALOG_ITEM_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
)

const ALLOWED_STATUS = new Set(Object.values(CATALOG_ITEM_STATUS))

export function isAllowedCatalogStatus(status) {
  return ALLOWED_STATUS.has(status)
}

export function getCatalogStatusLabel(status) {
  return CATALOG_ITEM_STATUS_LABELS[status] ?? 'Status desconhecido'
}

export function assertAllowedCatalogStatus(status) {
  if (!isAllowedCatalogStatus(status)) {
    throw new TypeError(
      'Status inválido. Use: Quero ver, Assistindo, Concluído, Em pausa ou Abandonado.',
    )
  }

  return status
}

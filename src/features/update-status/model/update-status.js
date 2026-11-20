import { assertAllowedCatalogStatus } from '../../../entities/catalog-item/model/catalog-item-status'
import { jsonServerResources } from '../../../shared/api/json-server/resources'

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo obrigatório inválido: ${fieldName}`)
  }

  return value.trim()
}

export async function updateCatalogItemStatus({
  id,
  status,
  resources = jsonServerResources,
} = {}) {
  const itemId = normalizeRequiredString(id, 'id')
  const nextStatus = assertAllowedCatalogStatus(status)

  return resources.catalogItems.updateStatus({
    id: itemId,
    status: nextStatus,
  })
}

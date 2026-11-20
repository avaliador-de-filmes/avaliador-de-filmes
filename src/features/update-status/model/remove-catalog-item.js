import { jsonServerResources } from '../../../shared/api/json-server/resources'

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo obrigatório inválido: ${fieldName}`)
  }

  return value.trim()
}

export async function removeCatalogItem({
  id,
  resources = jsonServerResources,
} = {}) {
  const itemId = normalizeRequiredString(id, 'id')

  await resources.catalogItems.remove(itemId)

  return {
    removed: true,
    id: itemId,
  }
}

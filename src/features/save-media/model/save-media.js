import { CATALOG_ITEM_STATUS } from '../../../entities/catalog-item/model/catalog-item.schema'
import { JsonServerClientError } from '../../../shared/api/json-server/client'
import { jsonServerResources } from '../../../shared/api/json-server/resources'

const EMPTY_YEAR = '—'

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo obrigatório inválido: ${fieldName}`)
  }

  return value.trim()
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toMediaRecord(media, mediaId) {
  return {
    id: mediaId,
    type: media?.type === 'series' ? 'series' : 'movie',
    title: normalizeOptionalString(media?.title) ?? mediaId,
    year: normalizeOptionalString(media?.year) ?? EMPTY_YEAR,
    posterUrl: normalizeOptionalString(media?.posterUrl),
    plot: normalizeOptionalString(media?.plot),
    genres: Array.isArray(media?.genres)
      ? media.genres
          .map((genre) => normalizeOptionalString(genre))
          .filter(Boolean)
      : [],
    imdbRating:
      media?.imdbRating === null || media?.imdbRating === undefined
        ? null
        : Number(media.imdbRating),
    updatedAt: normalizeOptionalString(media?.updatedAt) ?? new Date().toISOString(),
  }
}

/**
 * Combina os dados novos com o registro local já persistido, mantendo o valor
 * antigo quando a fonte externa não trouxe aquele campo. Evita apagar uma capa
 * ou sinopse válida por causa de uma resposta incompleta do OMDb.
 */
function mergeMediaRecords(existing, incoming) {
  if (!existing) {
    return incoming
  }

  return {
    ...existing,
    ...incoming,
    title: incoming.title || existing.title || incoming.id,
    year:
      incoming.year && incoming.year !== EMPTY_YEAR
        ? incoming.year
        : existing.year || incoming.year,
    posterUrl: incoming.posterUrl ?? existing.posterUrl ?? null,
    plot: incoming.plot ?? existing.plot ?? null,
    genres:
      incoming.genres && incoming.genres.length > 0
        ? incoming.genres
        : existing.genres ?? [],
    imdbRating: incoming.imdbRating ?? existing.imdbRating ?? null,
  }
}

function hasMediaMetadata(media) {
  return Boolean(
    media &&
      (normalizeOptionalString(media.title) ||
        normalizeOptionalString(media.posterUrl) ||
        normalizeOptionalString(media.plot)),
  )
}

async function findExistingItem(resources, userId, mediaId) {
  return resources.catalogItems.findByUserAndMedia({ userId, mediaId })
}

/**
 * Atualiza os metadados locais da mídia sem criar item no catálogo.
 * Usado quando o item já existe e só precisamos sincronizar capa/título.
 */
export async function syncMediaMetadata({ media, resources = jsonServerResources } = {}) {
  const mediaId = normalizeRequiredString(media?.id, 'media.id')

  if (!hasMediaMetadata(media)) {
    return null
  }

  const existing = await resources.media.getById(mediaId).catch(() => null)

  return resources.media.upsert(mergeMediaRecords(existing, toMediaRecord(media, mediaId)))
}

export async function syncMediaMetadataQuietly({
  media,
  resources = jsonServerResources,
} = {}) {
  try {
    return await syncMediaMetadata({ media, resources })
  } catch {
    // Sincronização é complementar: uma falha aqui não invalida o item já salvo.
    return null
  }
}

export async function saveMedia({
  userId,
  media,
  resources = jsonServerResources,
} = {}) {
  const normalizedUserId = normalizeRequiredString(userId, 'userId')
  const mediaId = normalizeRequiredString(media?.id, 'media.id')

  const existing = await findExistingItem(resources, normalizedUserId, mediaId)

  if (existing) {
    // O item já existe: ainda assim atualizamos a mídia local para corrigir
    // capas antigas ou incompletas sem duplicar o catálogo.
    const syncedMedia = await syncMediaMetadataQuietly({ media, resources })

    return {
      created: false,
      alreadySaved: true,
      item: existing,
      media: syncedMedia,
      mediaId,
    }
  }

  const mediaRecord = toMediaRecord(media, mediaId)

  // Persiste os metadados da mídia para que o catálogo consiga exibir capa e título.
  await resources.media.upsert(mediaRecord)

  try {
    const item = await resources.catalogItems.create({
      userId: normalizedUserId,
      mediaId,
      status: CATALOG_ITEM_STATUS.wantToWatch,
    })

    return {
      created: true,
      alreadySaved: false,
      item,
      media: mediaRecord,
      mediaId,
    }
  } catch (error) {
    if (error instanceof JsonServerClientError && error.code === 'CONFLICT') {
      const item = await findExistingItem(resources, normalizedUserId, mediaId)

      return {
        created: false,
        alreadySaved: true,
        item,
        mediaId,
      }
    }

    throw error
  }
}

import { describe, expect, it, vi } from 'vitest'
import { JsonServerClientError } from '../../src/shared/api/json-server/client'
import {
  saveMedia,
  syncMediaMetadata,
  syncMediaMetadataQuietly,
} from '../../src/features/save-media/model/save-media'
import { updateCatalogItemStatus } from '../../src/features/update-status/model/update-status'
import { removeCatalogItem } from '../../src/features/update-status/model/remove-catalog-item'
import { CATALOG_ITEM_STATUS } from '../../src/entities/catalog-item/model/catalog-item.schema'
import {
  getCatalogStatusLabel,
  isAllowedCatalogStatus,
  assertAllowedCatalogStatus,
} from '../../src/entities/catalog-item/model/catalog-item-status'
import {
  calculateMediaRatingSummary,
  calculateMediaRatingSummaries,
} from '../../src/entities/rating/model/media-rating-summary'

const USER_ID = 'u_1'
const MEDIA_ID = 'tt0133093'

function createMedia(overrides = {}) {
  return {
    id: MEDIA_ID,
    type: 'movie',
    title: 'The Matrix',
    year: '1999',
    posterUrl: 'https://example.com/matrix.jpg',
    plot: 'Um programador descobre a verdade.',
    genres: ['Action', 'Sci-Fi'],
    imdbRating: 8.7,
    updatedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createItem(overrides = {}) {
  return {
    id: 'ci_1',
    userId: USER_ID,
    mediaId: MEDIA_ID,
    status: CATALOG_ITEM_STATUS.wantToWatch,
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createFakeResources(options = {}) {
  const state = {
    existingItem: options.existingItem ?? null,
    existingMedia: options.existingMedia ?? null,
    createdItem: options.createdItem ?? createItem(),
    createError: options.createError ?? null,
  }

  const resources = {
    catalogItems: {
      findByUserAndMedia: vi.fn(async () => state.existingItem),
      create: vi.fn(async (payload) => {
        if (state.createError) {
          throw state.createError
        }

        return { id: 'ci_novo', ...payload }
      }),
      updateStatus: vi.fn(async ({ id, status }) => ({
        id,
        status,
        updatedAt: '2026-11-20T00:00:00.000Z',
      })),
      remove: vi.fn(async () => undefined),
    },
    media: {
      getById: vi.fn(async () => state.existingMedia),
      upsert: vi.fn(async (record) => record),
    },
  }

  return { resources, state }
}

describe('saveMedia', () => {
  it('creates a catalog item with the default "querer ver" status', async () => {
    const { resources } = createFakeResources()

    const result = await saveMedia({
      userId: USER_ID,
      media: createMedia(),
      resources,
    })

    expect(result.created).toBe(true)
    expect(result.alreadySaved).toBe(false)
    expect(result.mediaId).toBe(MEDIA_ID)
    expect(resources.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MEDIA_ID,
        type: 'movie',
        title: 'The Matrix',
        genres: ['Action', 'Sci-Fi'],
      }),
    )
    expect(resources.catalogItems.create).toHaveBeenCalledWith({
      userId: USER_ID,
      mediaId: MEDIA_ID,
      status: CATALOG_ITEM_STATUS.wantToWatch,
    })
  })

  it('normalizes incomplete media metadata before persisting', async () => {
    const { resources } = createFakeResources()

    const result = await saveMedia({
      userId: ` ${USER_ID} `,
      media: {
        id: MEDIA_ID,
        type: 'documentary',
        title: '   ',
        year: null,
        genres: [' Drama ', ''],
        updatedAt: null,
      },
      resources,
    })

    expect(result.created).toBe(true)
    expect(resources.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MEDIA_ID,
        type: 'movie',
        title: MEDIA_ID,
        year: '—',
        plot: null,
        posterUrl: null,
        genres: ['Drama'],
        imdbRating: null,
      }),
    )
    expect(resources.catalogItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
    )
  })

  it('does not duplicate an item that is already saved and syncs the media', async () => {
    const existingItem = createItem({ id: 'ci_existente' })
    const { resources } = createFakeResources({
      existingItem,
      existingMedia: createMedia({ posterUrl: null, plot: null, genres: [] }),
    })

    const result = await saveMedia({
      userId: USER_ID,
      media: createMedia(),
      resources,
    })

    expect(result).toMatchObject({
      created: false,
      alreadySaved: true,
      item: existingItem,
      mediaId: MEDIA_ID,
    })
    expect(resources.catalogItems.create).not.toHaveBeenCalled()
    expect(resources.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MEDIA_ID,
        posterUrl: 'https://example.com/matrix.jpg',
        plot: 'Um programador descobre a verdade.',
        genres: ['Action', 'Sci-Fi'],
      }),
    )
  })

  it('keeps previous metadata when the incoming media is incomplete', async () => {
    const { resources } = createFakeResources({
      existingItem: createItem(),
      existingMedia: createMedia({ posterUrl: 'https://example.com/old.jpg' }),
    })

    await saveMedia({
      userId: USER_ID,
      media: createMedia({
        title: '',
        year: '—',
        posterUrl: null,
        plot: 'Nova sinopse vinda do OMDb.',
        genres: [],
        imdbRating: null,
      }),
      resources,
    })

    // toMediaRecord substitui um título vazio pelo próprio mediaId, então o
    // merge preserva os demais metadados locais (ano, capa, gêneros e nota).
    expect(resources.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: MEDIA_ID,
        year: '1999',
        posterUrl: 'https://example.com/old.jpg',
        plot: 'Nova sinopse vinda do OMDb.',
        genres: ['Action', 'Sci-Fi'],
        imdbRating: 8.7,
      }),
    )
  })

  it('reuses the existing item when creation reports a conflict', async () => {
    const conflictItem = createItem({ id: 'ci_concorrente' })
    const { resources, state } = createFakeResources({
      createError: new JsonServerClientError({
        code: 'CONFLICT',
        message: 'Item já existe.',
        status: 409,
      }),
    })

    resources.catalogItems.findByUserAndMedia
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(conflictItem)

    const result = await saveMedia({
      userId: USER_ID,
      media: createMedia(),
      resources,
    })

    expect(result).toMatchObject({
      created: false,
      alreadySaved: true,
      item: conflictItem,
    })
    expect(state.createError).toBeInstanceOf(JsonServerClientError)
  })

  it('rethrows unexpected creation errors', async () => {
    const failure = new JsonServerClientError({
      code: 'SERVER_ERROR',
      message: 'Falha interna.',
      status: 500,
    })
    const { resources } = createFakeResources({ createError: failure })

    await expect(
      saveMedia({ userId: USER_ID, media: createMedia(), resources }),
    ).rejects.toBe(failure)
  })

  it('validates required identifiers', async () => {
    const { resources } = createFakeResources()

    await expect(saveMedia({ userId: '', media: createMedia(), resources }))
      .rejects.toThrow(TypeError)
    await expect(saveMedia({ userId: USER_ID, media: {}, resources }))
      .rejects.toThrow(/media.id/)
  })
})

describe('syncMediaMetadata', () => {
  it('returns null when the media has no metadata to sync', async () => {
    const { resources } = createFakeResources()

    await expect(
      syncMediaMetadata({
        media: { id: MEDIA_ID, title: '  ', posterUrl: null, plot: null },
        resources,
      }),
    ).resolves.toBeNull()
    expect(resources.media.getById).not.toHaveBeenCalled()
    expect(resources.media.upsert).not.toHaveBeenCalled()
  })

  it('upserts merged metadata for an existing local record', async () => {
    const { resources } = createFakeResources({
      existingMedia: createMedia({ title: 'Título antigo' }),
    })

    await syncMediaMetadata({
      media: createMedia({ title: 'Título novo' }),
      resources,
    })

    expect(resources.media.getById).toHaveBeenCalledWith(MEDIA_ID)
    expect(resources.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Título novo' }),
    )
  })

  it('tolerates a missing local media record', async () => {
    const { resources } = createFakeResources()
    resources.media.getById.mockRejectedValueOnce(new Error('404'))

    await expect(
      syncMediaMetadata({ media: createMedia(), resources }),
    ).resolves.toMatchObject({ id: MEDIA_ID })
  })

  it('validates media.id', async () => {
    await expect(syncMediaMetadata({ media: {} })).rejects.toThrow(TypeError)
  })

  it('quietly swallows persistence failures', async () => {
    const { resources } = createFakeResources()
    resources.media.upsert.mockRejectedValueOnce(new Error('offline'))

    await expect(
      syncMediaMetadataQuietly({ media: createMedia(), resources }),
    ).resolves.toBeNull()
  })
})

describe('catalog status helpers', () => {
  it('lists the allowed statuses with labels', () => {
    expect(isAllowedCatalogStatus(CATALOG_ITEM_STATUS.watching)).toBe(true)
    expect(isAllowedCatalogStatus('assistido')).toBe(false)
    expect(getCatalogStatusLabel(CATALOG_ITEM_STATUS.completed)).toBe(
      'Concluído',
    )
    expect(getCatalogStatusLabel('desconhecido')).toBe('Status desconhecido')
  })

  it('asserts the status value', () => {
    expect(assertAllowedCatalogStatus(CATALOG_ITEM_STATUS.onHold)).toBe(
      CATALOG_ITEM_STATUS.onHold,
    )
    expect(() => assertAllowedCatalogStatus('nope')).toThrow(TypeError)
  })
})

describe('updateCatalogItemStatus', () => {
  it('updates the status through the catalog gateway', async () => {
    const { resources } = createFakeResources()

    const result = await updateCatalogItemStatus({
      id: ' ci_1 ',
      status: CATALOG_ITEM_STATUS.completed,
      resources,
    })

    expect(resources.catalogItems.updateStatus).toHaveBeenCalledWith({
      id: 'ci_1',
      status: CATALOG_ITEM_STATUS.completed,
    })
    expect(result).toMatchObject({
      id: 'ci_1',
      status: CATALOG_ITEM_STATUS.completed,
    })
  })

  it('rejects invalid ids and statuses before calling the gateway', async () => {
    const { resources } = createFakeResources()

    await expect(
      updateCatalogItemStatus({ id: ' ', status: 'watching', resources }),
    ).rejects.toThrow(TypeError)
    await expect(
      updateCatalogItemStatus({ id: 'ci_1', status: 'assistido', resources }),
    ).rejects.toThrow(TypeError)
    expect(resources.catalogItems.updateStatus).not.toHaveBeenCalled()
  })
})

describe('removeCatalogItem', () => {
  it('removes the catalog item by id', async () => {
    const { resources } = createFakeResources()

    await expect(removeCatalogItem({ id: ' ci_1 ', resources })).resolves.toEqual(
      { removed: true, id: 'ci_1' },
    )
    expect(resources.catalogItems.remove).toHaveBeenCalledWith('ci_1')
  })

  it('requires a non empty id', async () => {
    const { resources } = createFakeResources()

    await expect(removeCatalogItem({ id: '', resources })).rejects.toThrow(
      TypeError,
    )
    expect(resources.catalogItems.remove).not.toHaveBeenCalled()
  })
})

describe('media rating summary', () => {
  const ratings = [
    { mediaId: MEDIA_ID, value: 5 },
    { mediaId: MEDIA_ID, value: 4 },
    { mediaId: MEDIA_ID, value: '3' },
    { mediaId: MEDIA_ID, value: 9 },
    { mediaId: 'tt2', value: 1 },
    { mediaId: '  ', value: 5 },
  ]

  it('calculates average and count for a media id', () => {
    expect(calculateMediaRatingSummary(MEDIA_ID, ratings)).toEqual({
      mediaId: MEDIA_ID,
      averageRating: 4,
      ratingsCount: 3,
    })
  })

  it('rounds averages to two decimals', () => {
    expect(
      calculateMediaRatingSummary(MEDIA_ID, [
        { mediaId: MEDIA_ID, value: 5 },
        { mediaId: MEDIA_ID, value: 4 },
        { mediaId: MEDIA_ID, value: 4 },
      ]).averageRating,
    ).toBe(4.33)
  })

  it('returns zeroes for a missing media id', () => {
    expect(calculateMediaRatingSummary('   ', ratings)).toEqual({
      mediaId: '',
      averageRating: 0,
      ratingsCount: 0,
    })
  })

  it('returns zeroes when there are no valid ratings', () => {
    expect(
      calculateMediaRatingSummary('tt404', [{ mediaId: 'tt404', value: 0 }]),
    ).toEqual({ mediaId: 'tt404', averageRating: 0, ratingsCount: 0 })
  })

  it('groups summaries by media id, skipping invalid entries', () => {
    const summaries = calculateMediaRatingSummaries([
      ...ratings,
      { mediaId: '', value: 5 },
      { mediaId: 'tt3', value: 2 },
      null,
    ])

    expect(summaries).toEqual([
      { mediaId: MEDIA_ID, averageRating: 4, ratingsCount: 3 },
      { mediaId: 'tt2', averageRating: 1, ratingsCount: 1 },
      { mediaId: 'tt3', averageRating: 2, ratingsCount: 1 },
    ])
  })
})

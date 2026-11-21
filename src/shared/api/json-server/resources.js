import { JsonServerClientError, jsonServerClient } from './client'

function nowIso() {
  return new Date().toISOString()
}

function assertRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo obrigatório inválido: ${fieldName}`)
  }

  return value.trim()
}

function withDefaultTimestamps(payload) {
  const timestamp = nowIso()

  return {
    ...payload,
    createdAt: payload.createdAt ?? timestamp,
    updatedAt: payload.updatedAt ?? timestamp,
  }
}

function withUpdatedAt(payload) {
  return {
    ...payload,
    updatedAt: payload.updatedAt ?? nowIso(),
  }
}

function notFoundToNull(error) {
  if (error instanceof JsonServerClientError && error.code === 'NOT_FOUND') {
    return null
  }

  throw error
}

function createCatalogItemsGateway(client) {
  return {
    listByUser(userId) {
      return client.get('/catalogItems', {
        query: { userId: assertRequiredString(userId, 'userId') },
      })
    },

    list(query = {}) {
      return client.get('/catalogItems', { query })
    },

    async findByUserAndMedia({ userId, mediaId }) {
      const [item] = await client.get('/catalogItems', {
        query: {
          userId: assertRequiredString(userId, 'userId'),
          mediaId: assertRequiredString(mediaId, 'mediaId'),
        },
      })

      return item ?? null
    },

    create(payload) {
      const userId = assertRequiredString(payload?.userId, 'userId')
      const mediaId = assertRequiredString(payload?.mediaId, 'mediaId')
      const status = assertRequiredString(
        payload?.status ?? 'want_to_watch',
        'status',
      )

      return client.post(
        '/catalogItems',
        withDefaultTimestamps({
          userId,
          mediaId,
          status,
        }),
      )
    },

    update(id, patch = {}) {
      return client.patch(
        `/catalogItems/${assertRequiredString(id, 'id')}`,
        withUpdatedAt(patch),
      )
    },

    updateStatus({ id, status }) {
      return client.patch(`/catalogItems/${assertRequiredString(id, 'id')}`, {
        status: assertRequiredString(status, 'status'),
        updatedAt: nowIso(),
      })
    },

    remove(id) {
      return client.delete(`/catalogItems/${assertRequiredString(id, 'id')}`)
    },
  }
}

function createRatingsGateway(client) {
  return {
    listByMedia(mediaId) {
      return client.get('/ratings', {
        query: { mediaId: assertRequiredString(mediaId, 'mediaId') },
      })
    },

    listByUser(userId) {
      return client.get('/ratings', {
        query: { userId: assertRequiredString(userId, 'userId') },
      })
    },

    list(query = {}) {
      return client.get('/ratings', { query })
    },

    async findByUserAndMedia({ userId, mediaId }) {
      const [rating] = await client.get('/ratings', {
        query: {
          userId: assertRequiredString(userId, 'userId'),
          mediaId: assertRequiredString(mediaId, 'mediaId'),
        },
      })

      return rating ?? null
    },

    create(payload) {
      const userId = assertRequiredString(payload?.userId, 'userId')
      const mediaId = assertRequiredString(payload?.mediaId, 'mediaId')
      const value = Number(payload?.value)

      return client.post(
        '/ratings',
        withDefaultTimestamps({
          userId,
          mediaId,
          value,
        }),
      )
    },

    update(id, patch = {}) {
      return client.patch(
        `/ratings/${assertRequiredString(id, 'id')}`,
        withUpdatedAt(patch),
      )
    },

    updateValue({ id, value }) {
      return client.patch(`/ratings/${assertRequiredString(id, 'id')}`, {
        value: Number(value),
        updatedAt: nowIso(),
      })
    },

    remove(id) {
      return client.delete(`/ratings/${assertRequiredString(id, 'id')}`)
    },
  }
}

function createReviewsGateway(client) {
  return {
    async listByMedia(mediaId, options = {}) {
      const reviews = await client.get('/reviews', {
        query: { mediaId: assertRequiredString(mediaId, 'mediaId') },
      })

      if (options.includeDeleted) {
        return reviews
      }

      return reviews.filter((review) => !review?.isDeleted)
    },

    list(query = {}) {
      return client.get('/reviews', { query })
    },

    async findByUserAndMedia({ userId, mediaId, includeDeleted = true }) {
      const reviews = await client.get('/reviews', {
        query: {
          userId: assertRequiredString(userId, 'userId'),
          mediaId: assertRequiredString(mediaId, 'mediaId'),
        },
      })

      if (includeDeleted) {
        return reviews[0] ?? null
      }

      return reviews.find((review) => !review?.isDeleted) ?? null
    },

    create(payload) {
      const userId = assertRequiredString(payload?.userId, 'userId')
      const mediaId = assertRequiredString(payload?.mediaId, 'mediaId')
      const content = assertRequiredString(payload?.content, 'content')
      const timestamp = nowIso()

      return client.post('/reviews', {
        userId,
        mediaId,
        content,
        isDeleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: payload?.publishedAt ?? timestamp,
      })
    },

    update(id, patch = {}) {
      return client.patch(
        `/reviews/${assertRequiredString(id, 'id')}`,
        withUpdatedAt(patch),
      )
    },

    updateContent({ id, content }) {
      return client.patch(`/reviews/${assertRequiredString(id, 'id')}`, {
        content: assertRequiredString(content, 'content'),
        updatedAt: nowIso(),
      })
    },

    async remove(id, options = {}) {
      const reviewId = assertRequiredString(id, 'id')

      if (options.softDelete) {
        return client.patch(`/reviews/${reviewId}`, {
          isDeleted: true,
          updatedAt: nowIso(),
        })
      }

      return client.delete(`/reviews/${reviewId}`)
    },
  }
}

function createUsersGateway(client) {
  return {
    list(query = {}) {
      return client.get('/users', { query })
    },

    async getById(id) {
      try {
        return await client.get(`/users/${assertRequiredString(id, 'id')}`)
      } catch (error) {
        return notFoundToNull(error)
      }
    },

    async listByIds(ids = []) {
      const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()))).filter(
        Boolean,
      )

      const results = await Promise.all(uniqueIds.map((id) => this.getById(id)))

      return results.filter(Boolean)
    },
  }
}

function createMediaGateway(client) {
  return {
    list(query = {}) {
      return client.get('/media', { query })
    },

    async getById(id) {
      try {
        return await client.get(`/media/${assertRequiredString(id, 'id')}`)
      } catch (error) {
        return notFoundToNull(error)
      }
    },

    findById(id) {
      return this.getById(id)
    },

    async listByIds(ids = []) {
      const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()))).filter(
        Boolean,
      )

      const results = await Promise.all(
        uniqueIds.map((id) =>
          this.getById(id).catch((error) => {
            if (
              error instanceof JsonServerClientError &&
              error.code === 'NOT_FOUND'
            ) {
              return null
            }

            throw error
          }),
        ),
      )

      return results.filter(Boolean)
    },

    create(payload) {
      return client.post('/media', withDefaultTimestamps(payload))
    },

    update(id, patch = {}) {
      return client.patch(
        `/media/${assertRequiredString(id, 'id')}`,
        withUpdatedAt(patch),
      )
    },

    async upsert(payload) {
      const mediaId = assertRequiredString(payload?.id, 'id')
      const existing = await this.getById(mediaId)

      if (existing) {
        return this.update(mediaId, payload)
      }

      return this.create(payload)
    },
  }
}

export function createJsonServerResources(client = jsonServerClient) {
  return {
    users: createUsersGateway(client),
    catalogItems: createCatalogItemsGateway(client),
    ratings: createRatingsGateway(client),
    reviews: createReviewsGateway(client),
    media: createMediaGateway(client),
  }
}

export const jsonServerResources = createJsonServerResources()

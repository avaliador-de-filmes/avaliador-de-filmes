import { describe, expect, it } from 'vitest'
import {
  USER_CONSTRAINTS,
  assertUserSchema,
  validateUniqueUsernames,
  validateUserSchema,
} from '../../src/entities/user/model/user.schema'
import {
  MEDIA_CONSTRAINTS,
  assertMediaSchema,
  validateMediaSchema,
} from '../../src/entities/media/model/media.schema'
import {
  CATALOG_ITEM_STATUS,
  assertCatalogItemSchema,
  buildCatalogItemUniqueKey,
  validateCatalogItemSchema,
  validateCatalogItemUniqueness,
} from '../../src/entities/catalog-item/model/catalog-item.schema'
import {
  RATING_CONSTRAINTS,
  assertRatingSchema,
  buildRatingUniqueKey,
  validateRatingSchema,
  validateRatingUniqueness,
} from '../../src/entities/rating/model/rating.schema'
import {
  REVIEW_CONSTRAINTS,
  assertReviewSchema,
  buildReviewUniqueKey,
  validateReviewSchema,
  validateReviewUniqueness,
} from '../../src/entities/review/model/review.schema'

const ISO = '2026-11-18T12:00:00.000Z'

function errorFields(result) {
  return result.errors.map((error) => error.field)
}

describe('user schema', () => {
  const validUser = {
    id: 'u_1',
    username: 'giovana',
    displayName: 'Giovana',
    avatarUrl: null,
    createdAt: ISO,
  }

  it('accepts a valid user and normalizes strings', () => {
    const result = validateUserSchema({
      ...validUser,
      id: ' u_1 ',
      username: ' giovana ',
      displayName: ' Giovana ',
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value).toEqual({
      id: 'u_1',
      username: 'giovana',
      displayName: 'Giovana',
      avatarUrl: null,
      createdAt: ISO,
    })
  })

  it('accepts an http avatar url', () => {
    const result = validateUserSchema({
      ...validUser,
      avatarUrl: 'https://example.com/avatar.png',
    })

    expect(result.valid).toBe(true)
    expect(result.value.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('rejects a missing id', () => {
    const result = validateUserSchema({ ...validUser, id: '   ' })

    expect(result.valid).toBe(false)
    expect(errorFields(result)).toContain('id')
    expect(result.value).toBeNull()
  })

  it('enforces username length boundaries', () => {
    expect(
      validateUserSchema({
        ...validUser,
        username: 'a'.repeat(USER_CONSTRAINTS.usernameMin - 1),
      }).valid,
    ).toBe(false)
    expect(
      validateUserSchema({
        ...validUser,
        username: 'a'.repeat(USER_CONSTRAINTS.usernameMax + 1),
      }).valid,
    ).toBe(false)
    expect(
      validateUserSchema({ ...validUser, username: '' }).errors,
    ).toEqual([
      {
        field: 'username',
        message: expect.stringContaining('User.username'),
      },
    ])
  })

  it('enforces displayName length boundaries', () => {
    expect(validateUserSchema({ ...validUser, displayName: '' }).valid).toBe(
      false,
    )
    expect(
      validateUserSchema({
        ...validUser,
        displayName: 'a'.repeat(USER_CONSTRAINTS.displayNameMax + 1),
      }).valid,
    ).toBe(false)
  })

  it('rejects invalid avatar urls and non-string values', () => {
    expect(
      validateUserSchema({ ...validUser, avatarUrl: 'nao-e-url' }).errors,
    ).toEqual([
      expect.objectContaining({ field: 'avatarUrl' }),
    ])
    expect(
      validateUserSchema({ ...validUser, avatarUrl: 42 }).valid,
    ).toBe(false)
  })

  it('rejects an invalid createdAt', () => {
    const result = validateUserSchema({ ...validUser, createdAt: 'ontem' })

    expect(result.valid).toBe(false)
    expect(errorFields(result)).toEqual(['createdAt'])
  })

  it('assertUserSchema returns the value or throws TypeError', () => {
    expect(assertUserSchema(validUser)).toMatchObject({ id: 'u_1' })
    expect(() => assertUserSchema({})).toThrow(TypeError)
  })

  it('detects duplicated usernames case-insensitively', () => {
    const result = validateUniqueUsernames([
      { username: 'Giovana' },
      { username: 'giovana' },
      { username: '   ' },
      { username: 'outro' },
    ])

    expect(result.valid).toBe(false)
    expect(result.duplicatedUsernames).toEqual(['giovana'])
  })

  it('reports valid when usernames are unique', () => {
    expect(
      validateUniqueUsernames([{ username: 'ana' }, { username: 'bia' }]),
    ).toEqual({ valid: true, duplicatedUsernames: [] })
  })
})

describe('media schema', () => {
  const validMedia = {
    id: 'tt0133093',
    type: 'movie',
    title: 'The Matrix',
    year: '1999',
    posterUrl: 'https://example.com/poster.jpg',
    plot: 'Um programador descobre a verdade.',
    genres: ['Action', 'Sci-Fi'],
    imdbRating: 8.7,
    updatedAt: ISO,
  }

  it('accepts a valid media and normalizes the type', () => {
    const result = validateMediaSchema({ ...validMedia, type: 'SERIES' })

    expect(result.valid).toBe(true)
    expect(result.value).toMatchObject({
      id: 'tt0133093',
      type: 'series',
      title: 'The Matrix',
      imdbRating: 8.7,
      genres: ['Action', 'Sci-Fi'],
    })
  })

  it('accepts null optional fields and a series year range', () => {
    const result = validateMediaSchema({
      ...validMedia,
      year: '2018–2020',
      posterUrl: null,
      plot: null,
      imdbRating: null,
    })

    expect(result.valid).toBe(true)
    expect(result.value.posterUrl).toBeNull()
    expect(result.value.plot).toBeNull()
    expect(result.value.imdbRating).toBeNull()
  })

  it('normalizes genres by trimming and removing blanks', () => {
    const result = validateMediaSchema({
      ...validMedia,
      genres: [' Action ', '', '   ', 'Drama'],
    })

    expect(result.value.genres).toEqual(['Action', 'Drama'])
  })

  it('rejects an id that is not an imdbID', () => {
    const result = validateMediaSchema({ ...validMedia, id: '123' })

    expect(result.valid).toBe(false)
    expect(errorFields(result)).toContain('id')
  })

  it('rejects an unsupported media type', () => {
    expect(
      validateMediaSchema({ ...validMedia, type: 'book' }).valid,
    ).toBe(false)
  })

  it('enforces title boundaries', () => {
    expect(validateMediaSchema({ ...validMedia, title: '  ' }).valid).toBe(false)
    expect(
      validateMediaSchema({
        ...validMedia,
        title: 'a'.repeat(MEDIA_CONSTRAINTS.titleMax + 1),
      }).valid,
    ).toBe(false)
  })

  it('rejects years outside the OMDb format', () => {
    expect(validateMediaSchema({ ...validMedia, year: '99' }).valid).toBe(false)
    expect(validateMediaSchema({ ...validMedia, year: 'hoje' }).valid).toBe(false)
  })

  it('rejects invalid poster urls, plots and genres', () => {
    const result = validateMediaSchema({
      ...validMedia,
      posterUrl: 'nao-e-url',
      plot: 12,
      genres: 'Action',
    })

    expect(result.valid).toBe(false)
    expect(errorFields(result)).toEqual(
      expect.arrayContaining(['posterUrl', 'plot', 'genres']),
    )
  })

  it('rejects imdbRating outside 0..10', () => {
    expect(validateMediaSchema({ ...validMedia, imdbRating: -1 }).valid).toBe(
      false,
    )
    expect(validateMediaSchema({ ...validMedia, imdbRating: 11 }).valid).toBe(
      false,
    )
    expect(validateMediaSchema({ ...validMedia, imdbRating: 'abc' }).valid).toBe(
      false,
    )
  })

  it('coerces numeric strings for imdbRating', () => {
    const result = validateMediaSchema({ ...validMedia, imdbRating: '8.1' })

    expect(result.valid).toBe(true)
    expect(result.value.imdbRating).toBe(8.1)
  })

  it('rejects an invalid updatedAt', () => {
    expect(
      validateMediaSchema({ ...validMedia, updatedAt: 'invalido' }).valid,
    ).toBe(false)
  })

  it('assertMediaSchema returns the value or throws TypeError', () => {
    expect(assertMediaSchema(validMedia)).toMatchObject({ id: 'tt0133093' })
    expect(() => assertMediaSchema({})).toThrow(TypeError)
  })
})

describe('catalog item schema', () => {
  const validItem = {
    id: 'ci_1',
    userId: 'u_1',
    mediaId: 'tt0133093',
    status: CATALOG_ITEM_STATUS.wantToWatch,
    createdAt: ISO,
    updatedAt: ISO,
  }

  it('accepts a valid item', () => {
    expect(validateCatalogItemSchema(validItem)).toEqual({
      valid: true,
      errors: [],
      value: validItem,
    })
  })

  it('rejects missing required fields', () => {
    const result = validateCatalogItemSchema({
      id: '',
      userId: ' ',
      mediaId: '',
      status: '',
      createdAt: null,
      updatedAt: 'invalido',
    })

    expect(result.valid).toBe(false)
    expect(errorFields(result)).toEqual([
      'id',
      'userId',
      'mediaId',
      'status',
      'createdAt',
      'updatedAt',
    ])
  })

  it('rejects a status outside the allowed set', () => {
    expect(
      validateCatalogItemSchema({ ...validItem, status: 'assistido' }).valid,
    ).toBe(false)
  })

  it('builds a trimmed unique key', () => {
    expect(
      buildCatalogItemUniqueKey({ userId: ' u_1 ', mediaId: ' tt1 ' }),
    ).toBe('u_1::tt1')
  })

  it('detects duplicated user+media pairs', () => {
    const result = validateCatalogItemUniqueness([
      validItem,
      { ...validItem, id: 'ci_2' },
      { id: 'ci_3' },
    ])

    expect(result.valid).toBe(false)
    expect(result.duplicatedKeys).toEqual(['u_1::tt0133093'])
  })

  it('reports valid when every pair is unique', () => {
    expect(
      validateCatalogItemUniqueness([
        validItem,
        { ...validItem, mediaId: 'tt0133094' },
      ]),
    ).toEqual({ valid: true, duplicatedKeys: [] })
  })

  it('assertCatalogItemSchema returns the value or throws TypeError', () => {
    expect(assertCatalogItemSchema(validItem)).toEqual(validItem)
    expect(() => assertCatalogItemSchema({})).toThrow(TypeError)
  })
})

describe('rating schema', () => {
  const validRating = {
    id: 'rt_1',
    userId: 'u_1',
    mediaId: 'tt0133093',
    value: 4,
    createdAt: ISO,
    updatedAt: ISO,
  }

  it('accepts a valid rating', () => {
    expect(validateRatingSchema(validRating)).toEqual({
      valid: true,
      errors: [],
      value: validRating,
    })
  })

  it('accepts boundary values 1 and 5', () => {
    for (const value of [RATING_CONSTRAINTS.min, RATING_CONSTRAINTS.max]) {
      expect(validateRatingSchema({ ...validRating, value }).valid).toBe(true)
    }
  })

  it('accepts numeric strings that represent integers', () => {
    const result = validateRatingSchema({ ...validRating, value: '3' })

    expect(result.valid).toBe(true)
    expect(result.value.value).toBe(3)
  })

  it('rejects out of range, fractional and textual values', () => {
    for (const value of [0, 6, 4.5, 'abc', '', null]) {
      const result = validateRatingSchema({ ...validRating, value })

      expect(result.valid).toBe(false)
      expect(errorFields(result)).toContain('value')
    }
  })

  it('rejects missing identifiers', () => {
    const result = validateRatingSchema({
      ...validRating,
      id: '',
      userId: '',
      mediaId: '',
    })

    expect(errorFields(result)).toEqual(
      expect.arrayContaining(['id', 'userId', 'mediaId']),
    )
  })

  it('rejects invalid timestamps', () => {
    expect(
      validateRatingSchema({ ...validRating, createdAt: 'ontem', updatedAt: 'ontem' })
        .valid,
    ).toBe(false)
  })

  it('builds the unique key from trimmed identifiers', () => {
    expect(buildRatingUniqueKey({ userId: 'u_1 ', mediaId: ' tt1' })).toBe(
      'u_1::tt1',
    )
  })

  it('detects duplicated ratings per user+media', () => {
    const result = validateRatingUniqueness([
      validRating,
      { ...validRating, id: 'rt_2', value: 5 },
      { id: 'rt_3' },
    ])

    expect(result.valid).toBe(false)
    expect(result.duplicatedKeys).toEqual(['u_1::tt0133093'])
  })

  it('reports valid when ratings are unique', () => {
    expect(
      validateRatingUniqueness([validRating, { ...validRating, mediaId: 'tt2' }]),
    ).toEqual({ valid: true, duplicatedKeys: [] })
  })

  it('assertRatingSchema returns the value or throws TypeError', () => {
    expect(assertRatingSchema(validRating)).toEqual(validRating)
    expect(() => assertRatingSchema({})).toThrow(TypeError)
  })
})

describe('review schema', () => {
  const validReview = {
    id: 'rv_1',
    userId: 'u_1',
    mediaId: 'tt0133093',
    content: 'Resenha com mais de vinte caracteres.',
    isDeleted: false,
    createdAt: ISO,
    updatedAt: ISO,
    publishedAt: ISO,
  }

  it('accepts a valid review and trims the content', () => {
    const result = validateReviewSchema({
      ...validReview,
      content: '   Uma resenha válida com 20+ caracteres.   ',
    })

    expect(result.valid).toBe(true)
    expect(result.value.content).toBe('Uma resenha válida com 20+ caracteres.')
  })

  it('accepts the exact minimum and maximum lengths after trim', () => {
    expect(
      validateReviewSchema({
        ...validReview,
        content: `   ${'a'.repeat(REVIEW_CONSTRAINTS.minLength)}   `,
      }).valid,
    ).toBe(true)
    expect(
      validateReviewSchema({
        ...validReview,
        content: 'a'.repeat(REVIEW_CONSTRAINTS.maxLength),
      }).valid,
    ).toBe(true)
  })

  it('rejects empty, whitespace-only and out of range content', () => {
    for (const content of [
      '',
      '     ',
      'a'.repeat(REVIEW_CONSTRAINTS.minLength - 1),
      'a'.repeat(REVIEW_CONSTRAINTS.maxLength + 1),
      42,
    ]) {
      const result = validateReviewSchema({ ...validReview, content })

      expect(result.valid).toBe(false)
      expect(errorFields(result)).toEqual(['content'])
    }
  })

  it('rejects a non boolean isDeleted', () => {
    expect(
      validateReviewSchema({ ...validReview, isDeleted: 'false' }).valid,
    ).toBe(false)
  })

  it('rejects invalid timestamps', () => {
    const result = validateReviewSchema({
      ...validReview,
      createdAt: 'x',
      updatedAt: 'x',
      publishedAt: 'x',
    })

    expect(errorFields(result)).toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt', 'publishedAt']),
    )
  })

  it('builds the unique key from trimmed identifiers', () => {
    expect(buildReviewUniqueKey({ userId: ' u_1', mediaId: 'tt1 ' })).toBe(
      'u_1::tt1',
    )
  })

  it('ignores deleted reviews when validating uniqueness', () => {
    expect(
      validateReviewUniqueness([
        validReview,
        { ...validReview, id: 'rv_2', isDeleted: true },
      ]),
    ).toEqual({ valid: true, duplicatedKeys: [] })
  })

  it('detects duplicated active reviews', () => {
    const result = validateReviewUniqueness([
      validReview,
      { ...validReview, id: 'rv_2' },
      { id: 'rv_3' },
    ])

    expect(result.valid).toBe(false)
    expect(result.duplicatedKeys).toEqual(['u_1::tt0133093'])
  })

  it('assertReviewSchema returns the value or throws TypeError', () => {
    expect(assertReviewSchema(validReview)).toMatchObject({ id: 'rv_1' })
    expect(() => assertReviewSchema({})).toThrow(TypeError)
  })
})

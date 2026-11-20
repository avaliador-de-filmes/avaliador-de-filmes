import { describe, expect, it } from 'vitest'
import {
  REVIEW_ACTIONS,
  REVIEW_PERMISSION_CODES,
  REVIEW_PERMISSION_MESSAGES,
  ReviewPermissionError,
  assertReviewActionAllowed,
  canPerformReviewAction,
  evaluateReviewAction,
  getReviewPermissions,
  isReviewOwner,
} from '../../src/features/review-media/model/review-permissions'

const OWNER_ID = 'u_1'
const OTHER_ID = 'u_2'

function createReview(overrides = {}) {
  return {
    id: 'rv_1',
    userId: OWNER_ID,
    mediaId: 'tt0133093',
    content: 'Resenha pública com mais de vinte caracteres.',
    isDeleted: false,
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    publishedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  }
}

function createSession(overrides = {}) {
  return {
    isAuthenticated: true,
    currentUserId: OWNER_ID,
    review: createReview(),
    ...overrides,
  }
}

describe('getReviewPermissions', () => {
  it('mantém visitante em modo somente leitura com leitura pública habilitada', () => {
    const permissions = getReviewPermissions({
      isAuthenticated: false,
      currentUserId: null,
      review: createReview(),
    })

    expect(permissions).toMatchObject({
      canRead: true,
      readOnly: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      isOwner: false,
      isAvailable: true,
    })
  })

  it('habilita criação para usuário autenticado com sessão completa', () => {
    const permissions = getReviewPermissions({
      isAuthenticated: true,
      currentUserId: OWNER_ID,
    })

    expect(permissions).toMatchObject({
      canRead: true,
      readOnly: false,
      canCreate: true,
      canEdit: false,
      canDelete: false,
      isOwner: false,
    })
  })

  it('habilita edição e exclusão apenas para o autor autenticado', () => {
    const permissions = getReviewPermissions(createSession())

    expect(permissions).toMatchObject({
      canCreate: true,
      canEdit: true,
      canDelete: true,
      isOwner: true,
      readOnly: false,
    })
  })

  it('não habilita mutação sobre resenha de outra autoria', () => {
    const permissions = getReviewPermissions(
      createSession({ currentUserId: OTHER_ID }),
    )

    expect(permissions).toMatchObject({
      canCreate: true,
      canEdit: false,
      canDelete: false,
      isOwner: false,
      readOnly: false,
    })
  })

  it('trata sessão autenticada sem usuário como incompleta', () => {
    const permissions = getReviewPermissions({
      isAuthenticated: true,
      currentUserId: '   ',
      review: createReview(),
    })

    expect(permissions).toMatchObject({
      canCreate: false,
      canEdit: false,
      canDelete: false,
      isOwner: false,
      readOnly: true,
    })
  })

  it('bloqueia mutação de resenha removida logicamente mesmo para o autor', () => {
    const permissions = getReviewPermissions(
      createSession({ review: createReview({ isDeleted: true }) }),
    )

    expect(permissions).toMatchObject({
      canCreate: true,
      canEdit: false,
      canDelete: false,
      isOwner: true,
      isAvailable: false,
    })
  })

  it('normaliza espaços ao comparar a autoria', () => {
    expect(
      getReviewPermissions(
        createSession({ currentUserId: `  ${OWNER_ID}  ` }),
      ).isOwner,
    ).toBe(true)
  })

  it('usa valores seguros quando chamado sem argumentos', () => {
    expect(getReviewPermissions()).toMatchObject({
      canRead: true,
      readOnly: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      isOwner: false,
      isAvailable: false,
    })
  })
})

describe('isReviewOwner', () => {
  it('compara o autor com o usuário da sessão', () => {
    expect(isReviewOwner(createReview(), OWNER_ID)).toBe(true)
    expect(isReviewOwner(createReview(), OTHER_ID)).toBe(false)
    expect(isReviewOwner(null, OWNER_ID)).toBe(false)
    expect(isReviewOwner(createReview(), null)).toBe(false)
  })

  it('ignora diferenças de espaçamento no identificador', () => {
    expect(isReviewOwner(createReview(), ` ${OWNER_ID} `)).toBe(true)
    expect(isReviewOwner(createReview({ userId: ` ${OWNER_ID} ` }), OWNER_ID)).toBe(
      true,
    )
  })
})

describe('evaluateReviewAction', () => {
  it('permite publicar quando o usuário está autenticado', () => {
    expect(
      evaluateReviewAction({
        action: REVIEW_ACTIONS.create,
        isAuthenticated: true,
        currentUserId: OWNER_ID,
      }),
    ).toEqual({
      action: REVIEW_ACTIONS.create,
      allowed: true,
      code: null,
      message: null,
      details: null,
    })
  })

  it('bloqueia publicação de visitante com AUTH_REQUIRED', () => {
    const decision = evaluateReviewAction({
      action: REVIEW_ACTIONS.create,
      isAuthenticated: false,
    })

    expect(decision).toMatchObject({
      allowed: false,
      code: REVIEW_PERMISSION_CODES.AUTH_REQUIRED,
      message: REVIEW_PERMISSION_MESSAGES.create,
      details: { action: REVIEW_ACTIONS.create },
    })
  })

  it('bloqueia edição e exclusão de visitante', () => {
    for (const action of [REVIEW_ACTIONS.edit, REVIEW_ACTIONS.delete]) {
      const decision = evaluateReviewAction({
        action,
        isAuthenticated: false,
        currentUserId: OWNER_ID,
        review: createReview(),
      })

      expect(decision).toMatchObject({
        allowed: false,
        code: REVIEW_PERMISSION_CODES.AUTH_REQUIRED,
        message: REVIEW_PERMISSION_MESSAGES[action],
        details: { action },
      })
    }
  })

  it('bloqueia edição de resenha de outra autoria com FORBIDDEN', () => {
    const decision = evaluateReviewAction(
      createSession({ action: REVIEW_ACTIONS.edit, currentUserId: OTHER_ID }),
    )

    expect(decision).toMatchObject({
      allowed: false,
      code: REVIEW_PERMISSION_CODES.FORBIDDEN,
      message: REVIEW_PERMISSION_MESSAGES.forbidden,
      details: { action: REVIEW_ACTIONS.edit, field: 'userId' },
    })
  })

  it('bloqueia mutação de resenha removida com NOT_AVAILABLE', () => {
    for (const action of [REVIEW_ACTIONS.edit, REVIEW_ACTIONS.delete]) {
      const decision = evaluateReviewAction(
        createSession({
          action,
          review: createReview({ isDeleted: true }),
        }),
      )

      expect(decision).toMatchObject({
        allowed: false,
        code: REVIEW_PERMISSION_CODES.NOT_AVAILABLE,
        message: REVIEW_PERMISSION_MESSAGES.notAvailable,
        details: { action, field: 'reviewId' },
      })
    }
  })

  it('bloqueia mutação sem resenha alvo', () => {
    const decision = evaluateReviewAction(
      createSession({ action: REVIEW_ACTIONS.delete, review: null }),
    )

    expect(decision).toMatchObject({
      allowed: false,
      code: REVIEW_PERMISSION_CODES.NOT_AVAILABLE,
    })
  })

  it('permite edição e exclusão do próprio autor', () => {
    for (const action of [REVIEW_ACTIONS.edit, REVIEW_ACTIONS.delete]) {
      expect(evaluateReviewAction(createSession({ action }))).toMatchObject({
        action,
        allowed: true,
        code: null,
        message: null,
        details: null,
      })
    }
  })

  it('rejeita ação desconhecida com INVALID_ACTION', () => {
    const decision = evaluateReviewAction({
      action: 'archive',
      isAuthenticated: true,
      currentUserId: OWNER_ID,
    })

    expect(decision).toMatchObject({
      allowed: false,
      code: REVIEW_PERMISSION_CODES.INVALID_ACTION,
      message: REVIEW_PERMISSION_MESSAGES.invalidAction,
      details: { action: 'archive' },
    })
  })
})

describe('canPerformReviewAction', () => {
  it('resume a decisão em um booleano', () => {
    expect(
      canPerformReviewAction({
        action: REVIEW_ACTIONS.edit,
        isAuthenticated: true,
        currentUserId: OWNER_ID,
        review: createReview(),
      }),
    ).toBe(true)

    expect(
      canPerformReviewAction({
        action: REVIEW_ACTIONS.edit,
        isAuthenticated: false,
        review: createReview(),
      }),
    ).toBe(false)
  })
})

describe('assertReviewActionAllowed', () => {
  it('retorna a ação quando a mutação é permitida', () => {
    expect(assertReviewActionAllowed(createSession({ action: REVIEW_ACTIONS.edit }))).toBe(
      REVIEW_ACTIONS.edit,
    )
  })

  it('lança ReviewPermissionError com código e detalhes para visitante', () => {
    const error = (() => {
      try {
        assertReviewActionAllowed({
          action: REVIEW_ACTIONS.create,
          isAuthenticated: false,
        })
        return null
      } catch (caught) {
        return caught
      }
    })()

    expect(error).toBeInstanceOf(ReviewPermissionError)
    expect(error).toMatchObject({
      name: 'ReviewPermissionError',
      code: REVIEW_PERMISSION_CODES.AUTH_REQUIRED,
      message: REVIEW_PERMISSION_MESSAGES.create,
      details: { action: REVIEW_ACTIONS.create },
    })
  })

  it('lança FORBIDDEN ao tentar alterar resenha de outra autoria', () => {
    expect(() =>
      assertReviewActionAllowed(
        createSession({ action: REVIEW_ACTIONS.delete, currentUserId: OTHER_ID }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: REVIEW_PERMISSION_CODES.FORBIDDEN,
      }),
    )
  })

  it('lança INVALID_ACTION para ação desconhecida', () => {
    expect(() =>
      assertReviewActionAllowed({
        action: 'archive',
        isAuthenticated: true,
        currentUserId: OWNER_ID,
      }),
    ).toThrow(
      expect.objectContaining({
        code: REVIEW_PERMISSION_CODES.INVALID_ACTION,
      }),
    )
  })
})

/**
 * Regras de permissão do ciclo de vida de resenhas (FR-014).
 *
 * Visitantes não autenticados possuem acesso somente leitura das resenhas
 * públicas; criar, editar e excluir exigem sessão autenticada. Além da
 * autenticação, edição e exclusão exigem que o usuário seja o autor da resenha
 * (data-model.md — Review.userId) e que o registro não esteja removido
 * logicamente (data-model.md — Review.isDeleted).
 */

export const REVIEW_ACTIONS = Object.freeze({
  create: 'create',
  edit: 'edit',
  delete: 'delete',
})

export const REVIEW_PERMISSION_CODES = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  INVALID_ACTION: 'INVALID_ACTION',
})

export const REVIEW_PERMISSION_MESSAGES = Object.freeze({
  create: 'Entre para publicar uma resenha.',
  edit: 'Entre para editar uma resenha.',
  delete: 'Entre para excluir uma resenha.',
  forbidden: 'Você só pode alterar resenhas de sua autoria.',
  notAvailable: 'Esta resenha não está mais disponível.',
  invalidAction: 'Ação de resenha inválida.',
})

const MUTATION_ACTIONS = Object.freeze([
  REVIEW_ACTIONS.create,
  REVIEW_ACTIONS.edit,
  REVIEW_ACTIONS.delete,
])

/**
 * Erro de permissão com o mesmo formato (code/message/details) usado pelo
 * cliente do JSON Server, para reutilizar o tratamento de erros da UI.
 */
export class ReviewPermissionError extends Error {
  constructor({ code, message, details = null }) {
    super(message)
    this.name = 'ReviewPermissionError'
    this.code = code
    this.details = details
  }
}

function normalizeUserId(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function normalizeAction(action) {
  return MUTATION_ACTIONS.includes(action) ? action : null
}

/**
 * Compara o autor da resenha com o usuário da sessão, ignorando espaços.
 */
export function isReviewOwner(review, currentUserId) {
  const sessionUserId = normalizeUserId(currentUserId)
  const authorId = normalizeUserId(review?.userId)

  return Boolean(sessionUserId && authorId && sessionUserId === authorId)
}

/**
 * Deriva as capacidades de UI a partir da sessão e, opcionalmente, da resenha
 * alvo. Visitantes permanecem sempre em modo somente leitura.
 */
export function getReviewPermissions({
  isAuthenticated = false,
  currentUserId = null,
  review = null,
} = {}) {
  const sessionUserId = normalizeUserId(currentUserId)
  const canMutate = Boolean(isAuthenticated && sessionUserId)
  const isAvailable = Boolean(review && !review.isDeleted)
  const isOwner = Boolean(canMutate && isReviewOwner(review, sessionUserId))
  const canEditTarget = isOwner && isAvailable

  return {
    canRead: true,
    readOnly: !canMutate,
    canCreate: canMutate,
    canEdit: canEditTarget,
    canDelete: canEditTarget,
    isOwner,
    isAvailable,
  }
}

function denied(action, code, message, details) {
  return {
    action,
    allowed: false,
    code,
    message,
    details,
  }
}

function allowed(action) {
  return {
    action,
    allowed: true,
    code: null,
    message: null,
    details: null,
  }
}

/**
 * Avalia uma ação de mutação sem lançar erro, devolvendo a decisão e a
 * mensagem adequada para exibição acessível na UI.
 */
export function evaluateReviewAction({
  action,
  isAuthenticated = false,
  currentUserId = null,
  review = null,
} = {}) {
  if (!normalizeAction(action)) {
    return denied(
      action ?? null,
      REVIEW_PERMISSION_CODES.INVALID_ACTION,
      REVIEW_PERMISSION_MESSAGES.invalidAction,
      { action: action ?? null },
    )
  }

  if (!isAuthenticated || !normalizeUserId(currentUserId)) {
    return denied(
      action,
      REVIEW_PERMISSION_CODES.AUTH_REQUIRED,
      REVIEW_PERMISSION_MESSAGES[action],
      { action },
    )
  }

  if (action === REVIEW_ACTIONS.create) {
    return allowed(action)
  }

  if (!review || review.isDeleted) {
    return denied(
      action,
      REVIEW_PERMISSION_CODES.NOT_AVAILABLE,
      REVIEW_PERMISSION_MESSAGES.notAvailable,
      { action, field: 'reviewId' },
    )
  }

  if (!isReviewOwner(review, currentUserId)) {
    return denied(
      action,
      REVIEW_PERMISSION_CODES.FORBIDDEN,
      REVIEW_PERMISSION_MESSAGES.forbidden,
      { action, field: 'userId' },
    )
  }

  return allowed(action)
}

export function canPerformReviewAction(input) {
  return evaluateReviewAction(input).allowed
}

/**
 * Valida a ação e lança ReviewPermissionError quando a mutação não é
 * permitida. Retorna a ação validada quando permitida.
 */
export function assertReviewActionAllowed(input) {
  const decision = evaluateReviewAction(input)

  if (!decision.allowed) {
    throw new ReviewPermissionError({
      code: decision.code,
      message: decision.message,
      details: decision.details,
    })
  }

  return decision.action
}

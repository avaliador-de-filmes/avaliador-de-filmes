export const USER_CONSTRAINTS = Object.freeze({
  usernameMin: 3,
  usernameMax: 30,
  displayNameMin: 1,
  displayNameMax: 60,
})

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isValidUrl(value) {
  if (typeof value !== 'string') {
    return false
  }

  try {
    // eslint-disable-next-line no-new
    new URL(value)
    return true
  } catch {
    return false
  }
}

function addError(errors, field, message) {
  errors.push({ field, message })
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateUserSchema(payload) {
  const errors = []
  const id = normalizeString(payload?.id)
  const username = normalizeString(payload?.username)
  const displayName = normalizeString(payload?.displayName)
  const avatarUrl = payload?.avatarUrl ?? null
  const createdAt = payload?.createdAt

  if (!id) {
    addError(errors, 'id', 'User.id é obrigatório e deve ser string não vazia.')
  }

  if (
    !username ||
    username.length < USER_CONSTRAINTS.usernameMin ||
    username.length > USER_CONSTRAINTS.usernameMax
  ) {
    addError(
      errors,
      'username',
      `User.username deve ter entre ${USER_CONSTRAINTS.usernameMin} e ${USER_CONSTRAINTS.usernameMax} caracteres.`,
    )
  }

  if (
    !displayName ||
    displayName.length < USER_CONSTRAINTS.displayNameMin ||
    displayName.length > USER_CONSTRAINTS.displayNameMax
  ) {
    addError(
      errors,
      'displayName',
      `User.displayName deve ter entre ${USER_CONSTRAINTS.displayNameMin} e ${USER_CONSTRAINTS.displayNameMax} caracteres.`,
    )
  }

  if (avatarUrl !== null && !isValidUrl(avatarUrl)) {
    addError(errors, 'avatarUrl', 'User.avatarUrl deve ser uma URL válida ou null.')
  }

  if (!isIsoDateString(createdAt)) {
    addError(errors, 'createdAt', 'User.createdAt deve estar em formato ISO-8601.')
  }

  const value = errors.length
    ? null
    : {
        id,
        username,
        displayName,
        avatarUrl: avatarUrl === null ? null : String(avatarUrl),
        createdAt,
      }

  return {
    valid: errors.length === 0,
    errors,
    value,
  }
}

export function assertUserSchema(payload) {
  const result = validateUserSchema(payload)

  if (!result.valid) {
    throw new TypeError(result.errors[0]?.message ?? 'User inválido.')
  }

  return result.value
}

export function validateUniqueUsernames(users = []) {
  const seen = new Set()
  const duplicated = new Set()

  for (const user of users) {
    const username = normalizeString(user?.username).toLowerCase()
    if (!username) {
      continue
    }

    if (seen.has(username)) {
      duplicated.add(username)
      continue
    }

    seen.add(username)
  }

  return {
    valid: duplicated.size === 0,
    duplicatedUsernames: Array.from(duplicated),
  }
}

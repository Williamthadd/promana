const PRIVATE_USER_IDENTIFIER_KEYS = new Set([
  'uid',
  'userid',
  'firebaseuid',
  'localid',
  'promanuserid',
  'authuid',
  'owneruid',
])

function isPrivateUserIdentifierKey(key) {
  const normalizedKey = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase()
  return PRIVATE_USER_IDENTIFIER_KEYS.has(normalizedKey)
}

export function sanitizeApiResponse(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeApiResponse)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isPrivateUserIdentifierKey(key))
      .map(([key, nestedValue]) => [key, sanitizeApiResponse(nestedValue)]),
  )
}

export function sendJson(response, status, payload) {
  return response.status(status).json(sanitizeApiResponse(payload))
}

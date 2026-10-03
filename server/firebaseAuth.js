/* global process */
// Shared Firebase Authentication verification for Vercel serverless routes.
//
// The Firebase UID is authoritative ONLY when derived from a verified ID
// token. Client-provided uid/email/role fields must never be trusted.
// Verification uses the Identity Toolkit accounts:lookup endpoint with the
// project's public web API key (comparable to the client SDK's own check);
// the token signature, expiry, revocation, and disabled state are enforced
// server-side by Google. Never decode the JWT without this verification.

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function getEnvironmentValue(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim()
}

export function getBearerToken(request) {
  const authorization = String(request.headers?.authorization ?? '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  if (!match || match[1].length > 8192) {
    throw new ApiError(401, 'Authentication is required.')
  }

  return match[1].trim()
}

function getClientIp(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] ?? '')
  const first = forwarded.split(',')[0]?.trim()
  if (first) return first.slice(0, 80)
  return String(request.socket?.remoteAddress ?? 'unknown').slice(0, 80)
}

// Verifies the Firebase ID token from the Authorization header and returns
// the authoritative { uid, email } pair. Throws ApiError(401/503) otherwise.
export async function verifyFirebaseUser(request, options = {}) {
  const { requireVerifiedEmail = false } = options
  const firebaseApiKey = getEnvironmentValue(
    'FIREBASE_WEB_API_KEY',
    process.env.VITE_FIREBASE_API_KEY,
  )

  if (!firebaseApiKey) {
    throw new ApiError(503, 'Authentication service is not configured.')
  }

  const idToken = getBearerToken(request)

  let authResponse
  try {
    authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    )
  } catch {
    throw new ApiError(503, 'Authentication service is unavailable.')
  }

  if (!authResponse.ok) {
    // Deliberately generic: do not leak whether the token was malformed,
    // expired, or revoked.
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }

  let payload
  try {
    payload = await authResponse.json()
  } catch {
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }

  const user = payload.users?.[0]

  if (!user?.localId || user.disabled) {
    throw new ApiError(401, 'Your account could not be verified.')
  }

  if (requireVerifiedEmail && (!user.email || !user.emailVerified)) {
    throw new ApiError(400, 'A verified email address is required.')
  }

  return {
    uid: user.localId,
    email: String(user.email ?? ''),
    ip: getClientIp(request),
  }
}

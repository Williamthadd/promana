/* global Buffer */
import { sendJson } from '../server/apiResponse.js'
import { checkRateLimit } from '../server/rateLimit.js'

const MAX_BODY_BYTES = 4096
const MAX_SHORT_FIELD = 120
const MAX_MESSAGE_FIELD = 300

function getClientIp(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] ?? '')
  const first = forwarded.split(',')[0]?.trim()
  if (first) return first.slice(0, 80)
  return String(request.socket?.remoteAddress ?? 'unknown').slice(0, 80)
}

// Allowlist + sanitize: only known scalar fields, length-capped, with
// CR/LF stripped so client input cannot forge log lines.
export function sanitizeField(value, maxLength) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function readRequestBody(request) {
  if (request.body && typeof request.body === 'object') {
    return Promise.resolve(request.body)
  }

  return new Promise((resolve, reject) => {
    let rawBody = ''

    request.on('data', (chunk) => {
      rawBody += chunk
      if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
      }
    })

    request.on('end', () => {
      if (!rawBody) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(rawBody))
      } catch {
        resolve({})
      }
    })
  })
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const limit = checkRateLimit({
    key: `log-auth-ip:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 1000,
  })
  if (!limit.allowed) {
    response.setHeader('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)))
    sendJson(response, 429, { error: 'Too many requests. Please slow down.' })
    return
  }

  let payload
  try {
    payload = await readRequestBody(request)
  } catch {
    sendJson(response, 413, { error: 'Request body is too large.' })
    return
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    sendJson(response, 400, { error: 'Invalid request.' })
    return
  }

  try {
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: 'Request body is too large.' })
      return
    }
  } catch {
    sendJson(response, 400, { error: 'Invalid request.' })
    return
  }

  const logPayload = {
    event: 'auth_failure',
    method: sanitizeField(payload.method, MAX_SHORT_FIELD) || 'unknown',
    authMode: sanitizeField(payload.authMode, MAX_SHORT_FIELD) || null,
    code: sanitizeField(payload.code, MAX_SHORT_FIELD) || 'unknown',
    message: sanitizeField(payload.message, MAX_MESSAGE_FIELD) || 'Unknown authentication error',
    // Never trust client-supplied network identity; record server-observed IP.
    ipAddress: getClientIp(request),
    emailProvided: payload.emailProvided === true,
    host: sanitizeField(request.headers.host, MAX_SHORT_FIELD) || null,
    path: '/api/log-auth-error',
    url: sanitizeField(payload.url, MAX_MESSAGE_FIELD) || null,
    userAgent: sanitizeField(
      request.headers['user-agent'],
      MAX_MESSAGE_FIELD,
    ) || null,
    occurredAt: new Date().toISOString(),
  }

  console.error('[AUTH_FAILURE]', JSON.stringify(logPayload))
  response.status(204).end()
}

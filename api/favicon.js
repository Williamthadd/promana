/* global Buffer */
import { sendJson } from '../server/apiResponse.js'
import { checkRateLimit } from '../server/rateLimit.js'

const ALLOWED_SIZES = new Set(['16', '32', '48', '64', '128', '256'])
const DEFAULT_SIZE = '128'
const MAX_DOMAIN_LENGTH = 253
const UPSTREAM_TIMEOUT_MS = 5000

function getClientIp(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] ?? '')
  const first = forwarded.split(',')[0]?.trim()
  if (first) return first.slice(0, 80)
  return String(request.socket?.remoteAddress ?? 'unknown').slice(0, 80)
}

// Strict hostname validation: no userinfo, port, path, whitespace, or
// control characters. Returns the normalized hostname or ''.
export function normalizeDomain(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw || raw.length > MAX_DOMAIN_LENGTH) return ''
  if (/[\s/@:?#[\]]/.test(raw)) return ''
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})?$/.test(raw)) return ''
  try {
    const parsed = new URL(`https://${raw}`)
    if (parsed.hostname !== raw) return ''
    if (parsed.username || parsed.password || parsed.port || parsed.pathname !== '/') return ''
    return raw
  } catch {
    return ''
  }
}

export function normalizeSize(value) {
  const size = String(value ?? DEFAULT_SIZE).trim()
  return ALLOWED_SIZES.has(size) ? size : DEFAULT_SIZE
}

export function escapeSvgText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const limit = checkRateLimit({
    key: `favicon-ip:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  })
  if (!limit.allowed) {
    response.setHeader('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)))
    response.setHeader('Cache-Control', 'no-store')
    sendJson(response, 429, { error: 'Too many requests. Please slow down.' })
    return
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const domain = normalizeDomain(url.searchParams.get('domain'))
  const size = normalizeSize(url.searchParams.get('size'))

  if (!domain) {
    response.setHeader('Cache-Control', 'no-store')
    sendJson(response, 400, { error: 'Domain is required' })
    return
  }

  try {
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${encodeURIComponent(size)}`
    const res = await fetchWithTimeout(googleFaviconUrl)

    if (res.ok) {
      const contentType = res.headers.get('Content-Type') || 'image/png'
      if (!/^(image\/[a-z0-9.+-]+)$/i.test(contentType.split(';')[0].trim())) {
        throw new Error('Unexpected upstream content type.')
      }
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength > 512 * 1024) {
        throw new Error('Upstream icon is too large.')
      }
      response.setHeader('Content-Type', contentType.split(';')[0].trim())
      response.setHeader('Cache-Control', 'public, max-age=86400') // cache for 1 day
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.status(200).send(Buffer.from(buffer))
      return
    }
  } catch {
    // Fail silently, fall through to SVG generator
  }

  // If the favicon load failed or returned non-200, return an SVG with the first letter
  const firstLetter = domain.charAt(0) || '?'
  const char = escapeSvgText(firstLetter.toUpperCase())
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <rect width="48" height="48" rx="16" fill="#eff6ff"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#1d4ed8">${char}</text>
    </svg>
  `.trim()

  response.setHeader('Content-Type', 'image/svg+xml')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cache-Control', 'public, max-age=3600') // cache SVG fallback for 1 hour
  response.status(200).send(svg)
}

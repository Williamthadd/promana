import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import path from 'node:path'

const SUPPORTED_IMAGE_TYPES = new Map([
  ['image/jpeg', { extension: '.jpg' }],
  ['image/png', { extension: '.png' }],
  ['image/webp', { extension: '.webp' }],
  ['image/gif', { extension: '.gif' }],
])

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{20,32}$/

export class OfflineTransferError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message)
    this.name = 'OfflineTransferError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function generateSessionCredentials() {
  return {
    id: randomBytes(16).toString('base64url'),
    token: randomBytes(32).toString('base64url'),
  }
}

export function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_PATTERN.test(id)
}

export function hashAccessToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest()
}

export function verifyAccessToken(token, expectedDigest) {
  if (typeof token !== 'string' || !expectedDigest || token.length < 32 || token.length > 128) {
    return false
  }

  const actualDigest = hashAccessToken(token)
  return actualDigest.length === expectedDigest.length
    && timingSafeEqual(actualDigest, expectedDigest)
}

export function normalizeImageMimeType(value) {
  const normalized = String(value || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()

  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') {
    return 'image/jpeg'
  }

  if (!SUPPORTED_IMAGE_TYPES.has(normalized)) {
    throw new OfflineTransferError(
      'UNSUPPORTED_IMAGE_TYPE',
      'Only JPEG, PNG, WEBP, and GIF images can be transferred.',
      415,
    )
  }

  return normalized
}

export function detectImageMimeType(bytes) {
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || [])

  if (input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    input.length >= 8
    && input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }

  if (input.length >= 6) {
    const signature = input.subarray(0, 6).toString('ascii')
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return 'image/gif'
    }
  }

  if (
    input.length >= 12
    && input.subarray(0, 4).toString('ascii') === 'RIFF'
    && input.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

export function assertImageSignature(bytes, declaredMimeType) {
  const normalizedMimeType = normalizeImageMimeType(declaredMimeType)
  const detectedMimeType = detectImageMimeType(bytes)

  if (detectedMimeType !== normalizedMimeType) {
    throw new OfflineTransferError(
      'IMAGE_SIGNATURE_MISMATCH',
      'The selected file does not match its declared image type.',
      415,
    )
  }

  return normalizedMimeType
}

function canonicalExtension(mimeType) {
  return SUPPORTED_IMAGE_TYPES.get(mimeType).extension
}

export function sanitizeFilename(filename, mimeType) {
  const normalizedMimeType = normalizeImageMimeType(mimeType)
  const input = String(filename || 'image')
    .replaceAll('\\', '/')
    .split('/')
    .at(-1)

  let safeName = input
    .normalize('NFC')
    .split('')
    .map(character => {
      const characterCode = character.charCodeAt(0)
      return characterCode <= 31 || characterCode === 127 ? '_' : character
    })
    .join('')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim()

  if (!safeName) {
    safeName = 'image'
  }

  const expectedExtension = canonicalExtension(normalizedMimeType)
  const currentExtension = path.extname(safeName).toLowerCase()
  const acceptedExtensions = normalizedMimeType === 'image/jpeg'
    ? new Set(['.jpg', '.jpeg'])
    : new Set([expectedExtension])

  if (!acceptedExtensions.has(currentExtension)) {
    safeName = currentExtension
      ? `${safeName.slice(0, -currentExtension.length)}${expectedExtension}`
      : `${safeName}${expectedExtension}`
  }

  const characters = Array.from(safeName)
  if (characters.length > 180) {
    const extension = path.extname(safeName)
    const baseLength = Math.max(1, 180 - Array.from(extension).length)
    safeName = `${characters.slice(0, baseLength).join('')}${extension}`
  }

  return safeName
}

function encodeRfc5987(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ))
}

export function createContentDisposition(filename) {
  const asciiFallback = filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180) || 'image'

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`
}

export function decodeFilenameHeader(value, encoding) {
  if (!value) {
    throw new OfflineTransferError('MISSING_FILENAME', 'An image filename is required.', 400)
  }

  if (!encoding) {
    return String(value)
  }

  if (String(encoding).toLowerCase() !== 'percent') {
    throw new OfflineTransferError('INVALID_FILENAME_ENCODING', 'Unsupported filename encoding.', 400)
  }

  try {
    return decodeURIComponent(String(value))
  } catch {
    throw new OfflineTransferError('INVALID_FILENAME_ENCODING', 'The encoded filename is invalid.', 400)
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

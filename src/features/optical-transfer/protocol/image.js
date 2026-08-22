import {
  IMAGE_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILENAME_BYTES,
  SUPPORTED_IMAGE_MIME_TYPES,
} from './constants.js'
import { asUint8Array } from './bytes.js'
import { assertProtocol } from './errors.js'

const textEncoder = new TextEncoder()
const UNSAFE_FILENAME_CHARACTERS = new Set([
  '/',
  '\\',
  ':',
  '*',
  '?',
  '"',
  '<',
  '>',
  '|',
])
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export function normalizeImageMimeType(value) {
  const mimeType = String(value ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()

  if (mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
    return IMAGE_MIME_TYPES.JPEG
  }
  return mimeType
}

export function assertSupportedImageMimeType(value) {
  const mimeType = normalizeImageMimeType(value)
  assertProtocol(
    SUPPORTED_IMAGE_MIME_TYPES.has(mimeType),
    'UNSUPPORTED_MIME_TYPE',
    'Optical transfer supports PNG, JPEG, WebP, and GIF images only.',
  )
  return mimeType
}

export function assertValidFileSize(value) {
  assertProtocol(
    Number.isSafeInteger(value) && value > 0,
    'INVALID_FILE_SIZE',
    'The image must contain at least one byte.',
  )
  assertProtocol(
    value <= MAX_FILE_SIZE,
    'FILE_TOO_LARGE',
    `Optical transfer is limited to ${MAX_FILE_SIZE} bytes per image.`,
  )
  return value
}

function isUnsafeFilenameCodePoint(character) {
  const codePoint = character.codePointAt(0)
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  )
}

function truncateUtf8(value, maximumBytes) {
  let output = ''
  let usedBytes = 0

  for (const character of value) {
    const characterBytes = textEncoder.encode(character).length
    if (usedBytes + characterBytes > maximumBytes) {
      break
    }
    output += character
    usedBytes += characterBytes
  }
  return output
}

export function sanitizeFilename(value) {
  let filename = String(value ?? '')

  try {
    filename = filename.normalize('NFKC')
  } catch {
    // Old browsers may lack String#normalize. The remaining filters are still
    // applied, and the UTF-8 encoder provides a safe on-wire representation.
  }

  filename = Array.from(filename, (character) => {
    if (
      isUnsafeFilenameCodePoint(character) ||
      UNSAFE_FILENAME_CHARACTERS.has(character)
    ) {
      return '_'
    }
    return character
  }).join('')

  filename = filename
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[ .]+$/g, '')
    .trim()

  if (!filename) {
    filename = 'image'
  }
  if (WINDOWS_RESERVED_NAMES.test(filename)) {
    filename = `_${filename}`
  }

  filename = truncateUtf8(filename, MAX_FILENAME_BYTES)
    .replace(/[ .]+$/g, '')
    .trim()
  return filename || 'image'
}

function startsWith(bytes, signature, offset = 0) {
  if (bytes.length < offset + signature.length) {
    return false
  }
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

export function detectImageMimeType(value) {
  const bytes = asUint8Array(value)

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return IMAGE_MIME_TYPES.PNG
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return IMAGE_MIME_TYPES.JPEG
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return IMAGE_MIME_TYPES.WEBP
  }
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return IMAGE_MIME_TYPES.GIF
  }

  return null
}

export function validateImageBytes(value, declaredMimeType) {
  const bytes = asUint8Array(value)
  assertValidFileSize(bytes.length)
  const mimeType = assertSupportedImageMimeType(declaredMimeType)
  const detectedMimeType = detectImageMimeType(bytes)

  assertProtocol(
    detectedMimeType !== null,
    'INVALID_IMAGE_MAGIC',
    'The reconstructed bytes do not have a supported image signature.',
  )
  assertProtocol(
    detectedMimeType === mimeType,
    'MIME_MAGIC_MISMATCH',
    `The image signature is ${detectedMimeType}, not ${mimeType}.`,
  )
  return mimeType
}


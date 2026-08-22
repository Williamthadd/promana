import { SESSION_ID_BYTES } from './constants.js'
import { assertProtocol, protocolError } from './errors.js'

const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const BASE64URL_LOOKUP = new Int16Array(128).fill(-1)

for (let index = 0; index < BASE64URL_ALPHABET.length; index += 1) {
  BASE64URL_LOOKUP[BASE64URL_ALPHABET.charCodeAt(index)] = index
}

export function asUint8Array(value, { copy = false, label = 'bytes' } = {}) {
  let bytes

  if (value instanceof Uint8Array) {
    bytes = value
  } else if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value)
  } else if (ArrayBuffer.isView(value)) {
    bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  } else {
    throw protocolError('INVALID_BYTES', `${label} must be binary data.`)
  }

  return copy ? bytes.slice() : bytes
}

export function concatBytes(parts, totalLength = undefined) {
  const arrays = parts.map((part) => asUint8Array(part))
  const length =
    totalLength ?? arrays.reduce((sum, bytes) => sum + bytes.length, 0)
  const output = new Uint8Array(length)
  let offset = 0

  for (const bytes of arrays) {
    assertProtocol(
      offset + bytes.length <= output.length,
      'SIZE_MISMATCH',
      'Binary parts exceed the declared output size.',
    )
    output.set(bytes, offset)
    offset += bytes.length
  }

  assertProtocol(
    offset === output.length,
    'SIZE_MISMATCH',
    'Binary parts do not fill the declared output size.',
  )
  return output
}

export function bytesEqual(leftValue, rightValue) {
  const left = asUint8Array(leftValue)
  const right = asUint8Array(rightValue)

  if (left.length !== right.length) {
    return false
  }

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

export function bytesToHex(value) {
  return Array.from(asUint8Array(value), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function encodeBase64Url(value) {
  const bytes = asUint8Array(value)
  let encoded = ''

  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]
    const hasSecond = offset + 1 < bytes.length
    const hasThird = offset + 2 < bytes.length
    const second = hasSecond ? bytes[offset + 1] : 0
    const third = hasThird ? bytes[offset + 2] : 0
    const value24 = (first << 16) | (second << 8) | third

    encoded += BASE64URL_ALPHABET[(value24 >>> 18) & 63]
    encoded += BASE64URL_ALPHABET[(value24 >>> 12) & 63]
    if (hasSecond) {
      encoded += BASE64URL_ALPHABET[(value24 >>> 6) & 63]
    }
    if (hasThird) {
      encoded += BASE64URL_ALPHABET[value24 & 63]
    }
  }

  return encoded
}

export function decodeBase64Url(value) {
  const encoded = String(value ?? '')
  assertProtocol(
    encoded.length > 0 && encoded.length % 4 !== 1,
    'MALFORMED_QR_PAYLOAD',
    'The QR payload has an invalid Base64URL length.',
  )

  const output = new Uint8Array(Math.floor((encoded.length * 6) / 8))
  let buffer = 0
  let bits = 0
  let outputOffset = 0

  for (let index = 0; index < encoded.length; index += 1) {
    const characterCode = encoded.charCodeAt(index)
    const decoded =
      characterCode < BASE64URL_LOOKUP.length
        ? BASE64URL_LOOKUP[characterCode]
        : -1
    assertProtocol(
      decoded >= 0,
      'MALFORMED_QR_PAYLOAD',
      'The QR payload is not valid unpadded Base64URL.',
    )

    buffer = (buffer << 6) | decoded
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output[outputOffset] = (buffer >>> bits) & 0xff
      outputOffset += 1
      buffer &= (1 << bits) - 1
    }
  }

  assertProtocol(
    bits === 0 || buffer === 0,
    'MALFORMED_QR_PAYLOAD',
    'The QR payload has non-canonical trailing bits.',
  )
  assertProtocol(
    encodeBase64Url(output) === encoded,
    'MALFORMED_QR_PAYLOAD',
    'The QR payload is not canonical Base64URL.',
  )
  return output
}

export function createSessionId() {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) {
    throw protocolError(
      'CRYPTO_UNAVAILABLE',
      'Secure random generation is unavailable in this browser.',
    )
  }

  return cryptoApi.getRandomValues(new Uint8Array(SESSION_ID_BYTES))
}

export function normalizeSessionId(value) {
  const bytes =
    typeof value === 'string' ? decodeBase64Url(value) : asUint8Array(value)
  assertProtocol(
    bytes.length === SESSION_ID_BYTES,
    'INVALID_SESSION_ID',
    `A session ID must contain exactly ${SESSION_ID_BYTES} bytes.`,
  )
  return bytes.slice()
}

export function formatSessionId(value) {
  return encodeBase64Url(normalizeSessionId(value))
}

export async function sha256(value) {
  const bytes = asUint8Array(value)
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle?.digest) {
    throw protocolError(
      'CRYPTO_UNAVAILABLE',
      'SHA-256 is unavailable in this browser.',
    )
  }

  return new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes))
}


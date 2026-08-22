import {
  COMMON_HEADER_BYTES,
  CRC_BYTES,
  FEC_SCHEMES,
  MAX_CHUNK_SIZE,
  MAX_FILENAME_BYTES,
  MAX_QR_PAYLOAD_LENGTH,
  MIME_CODE_TYPES,
  MIME_TYPE_CODES,
  MIN_CHUNK_SIZE,
  PACKET_TYPES,
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
  QR_PAYLOAD_PREFIX,
  SESSION_ID_BYTES,
  SHA256_BYTES,
} from './constants.js'
import {
  asUint8Array,
  bytesToHex,
  decodeBase64Url,
  encodeBase64Url,
  normalizeSessionId,
} from './bytes.js'
import { crc32 } from './crc32.js'
import { assertProtocol, protocolError } from './errors.js'
import {
  assertSupportedImageMimeType,
  assertValidFileSize,
  sanitizeFilename,
} from './image.js'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })
const METADATA_FIXED_PAYLOAD_BYTES = 45
const DATA_FIXED_PAYLOAD_BYTES = 6
const END_PAYLOAD_BYTES = 4
const MIN_PACKET_BYTES = COMMON_HEADER_BYTES + CRC_BYTES

function assertChunkSize(value) {
  assertProtocol(
    Number.isInteger(value) &&
      value >= MIN_CHUNK_SIZE &&
      value <= MAX_CHUNK_SIZE,
    'INVALID_CHUNK_SIZE',
    `Chunk size must be between ${MIN_CHUNK_SIZE} and ${MAX_CHUNK_SIZE} bytes.`,
  )
  return value
}

function assertFecScheme(value) {
  assertProtocol(
    value === FEC_SCHEMES.NONE,
    'UNSUPPORTED_FEC',
    'This protocol version supports numbered chunks without FEC only.',
  )
  return value
}

function createPacket(type, sessionIdValue, payloadBytes, fecScheme) {
  const sessionId = normalizeSessionId(sessionIdValue)
  assertFecScheme(fecScheme)
  const packet = new Uint8Array(
    COMMON_HEADER_BYTES + payloadBytes + CRC_BYTES,
  )

  for (let index = 0; index < PROTOCOL_MAGIC.length; index += 1) {
    packet[index] = PROTOCOL_MAGIC.charCodeAt(index)
  }
  packet[4] = PROTOCOL_VERSION
  packet[5] = type
  packet[6] = fecScheme & 0x0f
  packet[7] = 0
  packet.set(sessionId, 8)
  return packet
}

function writeChecksum(packet) {
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  view.setUint32(packet.length - CRC_BYTES, crc32(packet.subarray(0, -CRC_BYTES)))
  return packet
}

function validateMetadata(metadata) {
  const size = assertValidFileSize(Number(metadata?.size))
  const chunkSize = assertChunkSize(Number(metadata?.chunkSize))
  const totalChunks = Number(metadata?.totalChunks)
  const expectedChunks = Math.ceil(size / chunkSize)
  assertProtocol(
    Number.isInteger(totalChunks) && totalChunks === expectedChunks,
    'INVALID_TOTAL_CHUNKS',
    'The total chunk count does not match the declared size and chunk size.',
  )
  const mimeType = assertSupportedImageMimeType(metadata?.mimeType)
  const filename = sanitizeFilename(metadata?.filename)
  const filenameBytes = textEncoder.encode(filename)
  assertProtocol(
    filenameBytes.length > 0 && filenameBytes.length <= MAX_FILENAME_BYTES,
    'INVALID_FILENAME',
    'The sanitized filename is too long for optical transfer.',
  )
  const hash = asUint8Array(metadata?.sha256, {
    copy: true,
    label: 'SHA-256 hash',
  })
  assertProtocol(
    hash.length === SHA256_BYTES,
    'INVALID_SHA256',
    `The SHA-256 digest must contain exactly ${SHA256_BYTES} bytes.`,
  )
  const fecScheme = assertFecScheme(
    Number(metadata?.fecScheme ?? FEC_SCHEMES.NONE),
  )

  return {
    filename,
    filenameBytes,
    mimeType,
    size,
    chunkSize,
    totalChunks,
    sha256: hash,
    sha256Hex: bytesToHex(hash),
    fecScheme,
  }
}

export function serializeMetadataPacket({ sessionId, metadata }) {
  const normalized = validateMetadata(metadata)
  const packet = createPacket(
    PACKET_TYPES.METADATA,
    sessionId,
    METADATA_FIXED_PAYLOAD_BYTES + normalized.filenameBytes.length,
    normalized.fecScheme,
  )
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  let offset = COMMON_HEADER_BYTES

  view.setUint32(offset, normalized.size)
  offset += 4
  view.setUint16(offset, normalized.chunkSize)
  offset += 2
  view.setUint32(offset, normalized.totalChunks)
  offset += 4
  packet[offset] = MIME_TYPE_CODES[normalized.mimeType]
  offset += 1
  view.setUint16(offset, normalized.filenameBytes.length)
  offset += 2
  packet.set(normalized.sha256, offset)
  offset += SHA256_BYTES
  packet.set(normalized.filenameBytes, offset)

  return writeChecksum(packet)
}

export function serializeDataPacket({
  sessionId,
  chunkIndex,
  payload,
  fecScheme = FEC_SCHEMES.NONE,
}) {
  assertProtocol(
    Number.isInteger(chunkIndex) && chunkIndex >= 0 && chunkIndex <= 0xffffffff,
    'INVALID_CHUNK_INDEX',
    'A data packet has an invalid chunk index.',
  )
  const chunk = asUint8Array(payload, { label: 'Chunk payload' })
  assertProtocol(
    chunk.length > 0 && chunk.length <= MAX_CHUNK_SIZE,
    'INVALID_CHUNK_LENGTH',
    `A data packet must contain 1-${MAX_CHUNK_SIZE} bytes.`,
  )
  const packet = createPacket(
    PACKET_TYPES.DATA,
    sessionId,
    DATA_FIXED_PAYLOAD_BYTES + chunk.length,
    fecScheme,
  )
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  view.setUint32(COMMON_HEADER_BYTES, chunkIndex)
  view.setUint16(COMMON_HEADER_BYTES + 4, chunk.length)
  packet.set(chunk, COMMON_HEADER_BYTES + DATA_FIXED_PAYLOAD_BYTES)
  return writeChecksum(packet)
}

export function serializeEndPacket({
  sessionId,
  totalChunks,
  fecScheme = FEC_SCHEMES.NONE,
}) {
  assertProtocol(
    Number.isInteger(totalChunks) && totalChunks > 0 && totalChunks <= 0xffffffff,
    'INVALID_TOTAL_CHUNKS',
    'An end packet must declare a positive total chunk count.',
  )
  const packet = createPacket(
    PACKET_TYPES.END,
    sessionId,
    END_PAYLOAD_BYTES,
    fecScheme,
  )
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  view.setUint32(COMMON_HEADER_BYTES, totalChunks)
  return writeChecksum(packet)
}

function assertPacketPreamble(packet) {
  assertProtocol(
    packet.length >= MIN_PACKET_BYTES,
    'MALFORMED_PACKET',
    'The optical packet is too short.',
  )
  for (let index = 0; index < PROTOCOL_MAGIC.length; index += 1) {
    assertProtocol(
      packet[index] === PROTOCOL_MAGIC.charCodeAt(index),
      'WRONG_PROTOCOL',
      'This QR code is not a ProMana optical-transfer packet.',
    )
  }
  assertProtocol(
    packet[4] === PROTOCOL_VERSION,
    'UNSUPPORTED_VERSION',
    `Optical-transfer protocol version ${packet[4]} is not supported.`,
  )
  assertProtocol(
    packet[5] === PACKET_TYPES.METADATA ||
      packet[5] === PACKET_TYPES.DATA ||
      packet[5] === PACKET_TYPES.END,
    'UNKNOWN_PACKET_TYPE',
    'The optical packet type is not supported.',
  )
  assertProtocol(
    packet[7] === 0 && (packet[6] & 0xf0) === 0,
    'UNSUPPORTED_FLAGS',
    'The optical packet uses reserved flags.',
  )
  assertFecScheme(packet[6] & 0x0f)

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  const expectedChecksum = view.getUint32(packet.length - CRC_BYTES)
  const actualChecksum = crc32(packet.subarray(0, -CRC_BYTES))
  assertProtocol(
    expectedChecksum === actualChecksum,
    'CRC_MISMATCH',
    'The optical packet was corrupted in transit.',
  )
}

function parseMetadata(packet, base) {
  assertProtocol(
    packet.length >=
      COMMON_HEADER_BYTES + METADATA_FIXED_PAYLOAD_BYTES + 1 + CRC_BYTES,
    'MALFORMED_METADATA',
    'The metadata packet is too short.',
  )
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  let offset = COMMON_HEADER_BYTES
  const size = view.getUint32(offset)
  offset += 4
  const chunkSize = view.getUint16(offset)
  offset += 2
  const totalChunks = view.getUint32(offset)
  offset += 4
  const mimeCode = packet[offset]
  offset += 1
  const filenameLength = view.getUint16(offset)
  offset += 2
  const hash = packet.slice(offset, offset + SHA256_BYTES)
  offset += SHA256_BYTES

  assertProtocol(
    filenameLength > 0 && filenameLength <= MAX_FILENAME_BYTES,
    'INVALID_FILENAME',
    'The metadata filename length is invalid.',
  )
  assertProtocol(
    offset + filenameLength + CRC_BYTES === packet.length,
    'MALFORMED_METADATA',
    'The metadata packet length does not match its filename length.',
  )

  let decodedFilename
  try {
    decodedFilename = textDecoder.decode(
      packet.subarray(offset, offset + filenameLength),
    )
  } catch (error) {
    throw protocolError(
      'INVALID_FILENAME_ENCODING',
      'The metadata filename is not valid UTF-8.',
      { cause: error },
    )
  }

  const metadata = validateMetadata({
    filename: decodedFilename,
    mimeType: MIME_CODE_TYPES[mimeCode],
    size,
    chunkSize,
    totalChunks,
    sha256: hash,
    fecScheme: base.fecScheme,
  })

  return {
    ...base,
    type: 'metadata',
    metadata: {
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      size: metadata.size,
      chunkSize: metadata.chunkSize,
      totalChunks: metadata.totalChunks,
      sha256: metadata.sha256,
      sha256Hex: metadata.sha256Hex,
      fecScheme: metadata.fecScheme,
    },
  }
}

function parseData(packet, base) {
  assertProtocol(
    packet.length >=
      COMMON_HEADER_BYTES + DATA_FIXED_PAYLOAD_BYTES + 1 + CRC_BYTES,
    'MALFORMED_DATA',
    'The data packet is too short.',
  )
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  const chunkIndex = view.getUint32(COMMON_HEADER_BYTES)
  const payloadLength = view.getUint16(COMMON_HEADER_BYTES + 4)
  assertProtocol(
    payloadLength > 0 && payloadLength <= MAX_CHUNK_SIZE,
    'INVALID_CHUNK_LENGTH',
    'The data packet has an invalid payload length.',
  )
  assertProtocol(
    COMMON_HEADER_BYTES +
      DATA_FIXED_PAYLOAD_BYTES +
      payloadLength +
      CRC_BYTES ===
      packet.length,
    'MALFORMED_DATA',
    'The data packet length does not match its declared payload length.',
  )

  return {
    ...base,
    type: 'data',
    chunkIndex,
    payload: packet.slice(
      COMMON_HEADER_BYTES + DATA_FIXED_PAYLOAD_BYTES,
      -CRC_BYTES,
    ),
  }
}

function parseEnd(packet, base) {
  assertProtocol(
    packet.length === COMMON_HEADER_BYTES + END_PAYLOAD_BYTES + CRC_BYTES,
    'MALFORMED_END',
    'The end packet has an invalid length.',
  )
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  const totalChunks = view.getUint32(COMMON_HEADER_BYTES)
  assertProtocol(
    totalChunks > 0,
    'INVALID_TOTAL_CHUNKS',
    'The end packet has an invalid total chunk count.',
  )
  return {
    ...base,
    type: 'end',
    totalChunks,
  }
}

export function deserializePacket(value) {
  const packet = asUint8Array(value, { label: 'Optical packet' })
  assertPacketPreamble(packet)
  const sessionId = packet.slice(8, 8 + SESSION_ID_BYTES)
  const base = {
    protocol: PROTOCOL_MAGIC,
    version: PROTOCOL_VERSION,
    packetType: packet[5],
    fecScheme: packet[6] & 0x0f,
    sessionId,
    sessionIdText: encodeBase64Url(sessionId),
  }

  if (packet[5] === PACKET_TYPES.METADATA) {
    return parseMetadata(packet, base)
  }
  if (packet[5] === PACKET_TYPES.DATA) {
    return parseData(packet, base)
  }
  return parseEnd(packet, base)
}

export function encodeQrPayload(value) {
  return `${QR_PAYLOAD_PREFIX}${encodeBase64Url(asUint8Array(value))}`
}

export function decodeQrPayload(value) {
  const qrPayload = String(value ?? '').trim()
  assertProtocol(
    qrPayload.length <= MAX_QR_PAYLOAD_LENGTH,
    'QR_PAYLOAD_TOO_LARGE',
    'The scanned QR payload is too large.',
  )
  assertProtocol(
    qrPayload.startsWith(QR_PAYLOAD_PREFIX),
    'WRONG_PROTOCOL',
    'This QR code is not a ProMana optical-transfer frame.',
  )
  return decodeBase64Url(qrPayload.slice(QR_PAYLOAD_PREFIX.length))
}

export function parseQrPayload(value) {
  return deserializePacket(decodeQrPayload(value))
}

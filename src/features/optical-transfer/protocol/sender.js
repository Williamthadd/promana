import {
  FEC_SCHEMES,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  OPTICAL_TRANSFER_CONFIG,
} from './constants.js'
import {
  asUint8Array,
  bytesToHex,
  createSessionId,
  encodeBase64Url,
  normalizeSessionId,
  sha256,
} from './bytes.js'
import { assertProtocol } from './errors.js'
import {
  assertSupportedImageMimeType,
  assertValidFileSize,
  sanitizeFilename,
  validateImageBytes,
} from './image.js'
import {
  encodeQrPayload,
  serializeDataPacket,
  serializeEndPacket,
  serializeMetadataPacket,
} from './packets.js'

function validateChunkSize(value) {
  const chunkSize = Number(value)
  assertProtocol(
    Number.isInteger(chunkSize) &&
      chunkSize >= MIN_CHUNK_SIZE &&
      chunkSize <= MAX_CHUNK_SIZE,
    'INVALID_CHUNK_SIZE',
    `Chunk size must be between ${MIN_CHUNK_SIZE} and ${MAX_CHUNK_SIZE} bytes.`,
  )
  return chunkSize
}

async function readSourceBytes({ bytes, blob }) {
  if (bytes !== undefined) {
    return asUint8Array(bytes, { copy: true, label: 'Image bytes' })
  }
  if (blob && typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer())
  }
  throw new TypeError('prepareOpticalTransfer requires image bytes or a Blob.')
}

export function splitIntoChunks(value, chunkSize = OPTICAL_TRANSFER_CONFIG.chunkSize) {
  const bytes = asUint8Array(value, { label: 'Image bytes' })
  assertValidFileSize(bytes.length)
  const normalizedChunkSize = validateChunkSize(chunkSize)
  const chunks = []

  for (let offset = 0; offset < bytes.length; offset += normalizedChunkSize) {
    chunks.push(bytes.subarray(offset, offset + normalizedChunkSize))
  }
  return chunks
}

export async function prepareOpticalTransfer({
  bytes,
  blob,
  filename,
  mimeType,
  chunkSize = OPTICAL_TRANSFER_CONFIG.chunkSize,
  sessionId: requestedSessionId,
} = {}) {
  const sourceBytes = await readSourceBytes({ bytes, blob })
  assertValidFileSize(sourceBytes.length)
  const normalizedMimeType = assertSupportedImageMimeType(
    mimeType || blob?.type,
  )
  validateImageBytes(sourceBytes, normalizedMimeType)
  const normalizedChunkSize = validateChunkSize(chunkSize)
  const normalizedFilename = sanitizeFilename(filename || blob?.name || 'image')
  const sessionId = requestedSessionId
    ? normalizeSessionId(requestedSessionId)
    : createSessionId()
  const hash = await sha256(sourceBytes)
  const chunks = splitIntoChunks(sourceBytes, normalizedChunkSize)
  const metadata = Object.freeze({
    filename: normalizedFilename,
    mimeType: normalizedMimeType,
    size: sourceBytes.length,
    chunkSize: normalizedChunkSize,
    totalChunks: chunks.length,
    sha256: hash,
    sha256Hex: bytesToHex(hash),
    fecScheme: FEC_SCHEMES.NONE,
  })
  const metadataPacket = serializeMetadataPacket({ sessionId, metadata })
  const dataPackets = chunks.map((payload, chunkIndex) =>
    serializeDataPacket({
      sessionId,
      chunkIndex,
      payload,
      fecScheme: FEC_SCHEMES.NONE,
    }),
  )
  const endPacket = serializeEndPacket({
    sessionId,
    totalChunks: chunks.length,
    fecScheme: FEC_SCHEMES.NONE,
  })

  return Object.freeze({
    protocol: 'PMOT',
    version: 1,
    sessionId,
    sessionIdText: encodeBase64Url(sessionId),
    metadata,
    bytes: sourceBytes,
    chunks: Object.freeze(chunks),
    metadataPacket,
    dataPackets: Object.freeze(dataPackets),
    endPacket,
  })
}

function buildCycle(transfer, metadataInterval) {
  const cycle = []

  for (
    let firstChunk = 0;
    firstChunk < transfer.dataPackets.length;
    firstChunk += metadataInterval
  ) {
    cycle.push({ type: 'metadata', packet: transfer.metadataPacket })
    const groupEnd = Math.min(
      firstChunk + metadataInterval,
      transfer.dataPackets.length,
    )
    for (let chunkIndex = firstChunk; chunkIndex < groupEnd; chunkIndex += 1) {
      cycle.push({
        type: 'data',
        chunkIndex,
        packet: transfer.dataPackets[chunkIndex],
      })
    }
  }
  cycle.push({ type: 'end', packet: transfer.endPacket })
  return cycle
}

export function createLoopingFrameSchedule(
  transfer,
  {
    metadataInterval = OPTICAL_TRANSFER_CONFIG.metadataInterval,
    fps = OPTICAL_TRANSFER_CONFIG.fps,
  } = {},
) {
  assertProtocol(
    transfer?.metadataPacket instanceof Uint8Array &&
      transfer?.endPacket instanceof Uint8Array &&
      Array.isArray(transfer?.dataPackets) &&
      transfer.dataPackets.length > 0,
    'INVALID_TRANSFER',
    'A prepared optical transfer is required.',
  )
  assertProtocol(
    Number.isInteger(metadataInterval) &&
      metadataInterval >= 1 &&
      metadataInterval <= 255,
    'INVALID_METADATA_INTERVAL',
    'Metadata must repeat every 1-255 data frames.',
  )
  assertProtocol(
    Number.isFinite(fps) && fps >= 1 && fps <= 30,
    'INVALID_FRAME_RATE',
    'The optical frame rate must be between 1 and 30 FPS.',
  )

  const cycle = buildCycle(transfer, metadataInterval)

  function resolveFrame(frameNumber) {
    assertProtocol(
      Number.isSafeInteger(frameNumber) && frameNumber >= 0,
      'INVALID_FRAME_NUMBER',
      'The optical frame number must be a non-negative integer.',
    )
    const frameInCycle = frameNumber % cycle.length
    const cycleNumber = Math.floor(frameNumber / cycle.length)
    return { ...cycle[frameInCycle], frameNumber, frameInCycle, cycleNumber }
  }

  return Object.freeze({
    fps,
    frameDurationMs: 1_000 / fps,
    metadataInterval,
    framesPerCycle: cycle.length,
    cycleLength: cycle.length,
    metadataFramesPerCycle: Math.ceil(
      transfer.dataPackets.length / metadataInterval,
    ),
    estimatedFirstCycleSeconds: cycle.length / fps,
    getDescriptor(frameNumber) {
      const { packet: _packet, ...descriptor } = resolveFrame(frameNumber)
      return descriptor
    },
    getPacket(frameNumber) {
      return resolveFrame(frameNumber).packet.slice()
    },
    getQrPayload(frameNumber) {
      return encodeQrPayload(resolveFrame(frameNumber).packet)
    },
  })
}

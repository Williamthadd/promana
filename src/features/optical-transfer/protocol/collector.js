import { MAX_FILE_SIZE } from './constants.js'
import {
  bytesEqual,
  bytesToHex,
  concatBytes,
  encodeBase64Url,
  normalizeSessionId,
  sha256,
} from './bytes.js'
import { assertProtocol } from './errors.js'
import { validateImageBytes } from './image.js'
import { deserializePacket, parseQrPayload } from './packets.js'

function cloneMetadata(metadata) {
  if (!metadata) {
    return null
  }
  return {
    ...metadata,
    sha256: metadata.sha256.slice(),
  }
}

function metadataMatches(left, right) {
  return (
    left.filename === right.filename &&
    left.mimeType === right.mimeType &&
    left.size === right.size &&
    left.chunkSize === right.chunkSize &&
    left.totalChunks === right.totalChunks &&
    left.fecScheme === right.fecScheme &&
    bytesEqual(left.sha256, right.sha256)
  )
}

export class OpticalTransferCollector {
  constructor({ expectedSessionId, maxFileSize = MAX_FILE_SIZE } = {}) {
    assertProtocol(
      Number.isSafeInteger(maxFileSize) &&
        maxFileSize > 0 &&
        maxFileSize <= MAX_FILE_SIZE,
      'INVALID_FILE_SIZE_LIMIT',
      `The receiver file-size limit must be 1-${MAX_FILE_SIZE} bytes.`,
    )
    this._expectedSessionId = expectedSessionId
      ? normalizeSessionId(expectedSessionId)
      : null
    this._sessionId = this._expectedSessionId?.slice() ?? null
    this._maxFileSize = maxFileSize
    this._metadata = null
    this._chunks = new Map()
    this._duplicateCount = 0
    this._endSeen = false
    this._status = 'waiting-for-metadata'
    this._result = null
    this._verificationPromise = null
  }

  get metadata() {
    return cloneMetadata(this._metadata)
  }

  get sessionId() {
    return this._sessionId?.slice() ?? null
  }

  get uniqueChunks() {
    return this._chunks.size
  }

  get totalChunks() {
    return this._metadata?.totalChunks ?? 0
  }

  get duplicateCount() {
    return this._duplicateCount
  }

  get progress() {
    return this.totalChunks > 0 ? this.uniqueChunks / this.totalChunks : 0
  }

  get ready() {
    return this.totalChunks > 0 && this.uniqueChunks === this.totalChunks
  }

  getSnapshot() {
    return {
      status: this._status,
      sessionId: this._sessionId ? encodeBase64Url(this._sessionId) : null,
      metadata: cloneMetadata(this._metadata),
      uniqueChunks: this.uniqueChunks,
      totalChunks: this.totalChunks,
      duplicateCount: this._duplicateCount,
      progress: this.progress,
      ready: this.ready,
      complete: this._status === 'complete',
      endSeen: this._endSeen,
    }
  }

  _ignored(reason, packetType) {
    return {
      accepted: false,
      reason,
      packetType,
      duplicate: false,
      ready: this.ready,
      snapshot: this.getSnapshot(),
    }
  }

  _accepted(packetType, duplicate = false) {
    if (duplicate) {
      this._duplicateCount += 1
    }
    return {
      accepted: true,
      packetType,
      duplicate,
      ready: this.ready,
      snapshot: this.getSnapshot(),
    }
  }

  _isWrongSession(sessionId) {
    return this._sessionId && !bytesEqual(this._sessionId, sessionId)
  }

  ingestQrFrame(qrPayload) {
    return this._ingestParsedPacket(parseQrPayload(qrPayload))
  }

  ingestPacket(value) {
    // Always deserialize here. Accepting a packet-shaped object would let a
    // caller accidentally bypass CRC, version, length, and reserved-flag checks.
    return this._ingestParsedPacket(deserializePacket(value))
  }

  _ingestParsedPacket(packet) {

    if (this._isWrongSession(packet.sessionId)) {
      return this._ignored('session-mismatch', packet.type)
    }

    if (packet.type === 'metadata') {
      return this._ingestMetadata(packet)
    }
    if (packet.type === 'data') {
      return this._ingestData(packet)
    }
    return this._ingestEnd(packet)
  }

  _ingestMetadata(packet) {
    assertProtocol(
      packet.metadata.size <= this._maxFileSize,
      'FILE_TOO_LARGE',
      'The sender declared an image larger than this receiver permits.',
    )

    if (!this._sessionId) {
      this._sessionId = packet.sessionId.slice()
    }
    if (this._metadata) {
      assertProtocol(
        metadataMatches(this._metadata, packet.metadata),
        'METADATA_CONFLICT',
        'Repeated metadata for this session does not match.',
      )
      return this._accepted('metadata', true)
    }

    this._metadata = cloneMetadata(packet.metadata)
    this._status = 'receiving'
    return this._accepted('metadata')
  }

  _ingestData(packet) {
    if (!this._metadata) {
      return this._ignored('metadata-required', 'data')
    }

    const { chunkIndex, payload } = packet
    assertProtocol(
      chunkIndex >= 0 && chunkIndex < this._metadata.totalChunks,
      'INVALID_CHUNK_INDEX',
      'The data packet index is outside this transfer.',
    )
    const expectedLength =
      chunkIndex === this._metadata.totalChunks - 1
        ? this._metadata.size -
          this._metadata.chunkSize * (this._metadata.totalChunks - 1)
        : this._metadata.chunkSize
    assertProtocol(
      payload.length === expectedLength,
      'INVALID_CHUNK_LENGTH',
      'The data packet length does not match the transfer metadata.',
    )

    const existing = this._chunks.get(chunkIndex)
    if (existing) {
      assertProtocol(
        bytesEqual(existing, payload),
        'CHUNK_CONFLICT',
        'Two different payloads claim the same chunk index.',
      )
      return this._accepted('data', true)
    }

    this._chunks.set(chunkIndex, payload.slice())
    this._status = this.ready ? 'ready' : 'receiving'
    return this._accepted('data')
  }

  _ingestEnd(packet) {
    if (!this._metadata) {
      return this._ignored('metadata-required', 'end')
    }
    assertProtocol(
      packet.totalChunks === this._metadata.totalChunks,
      'INVALID_TOTAL_CHUNKS',
      'The end packet does not match the transfer metadata.',
    )

    const duplicate = this._endSeen
    this._endSeen = true
    return this._accepted('end', duplicate)
  }

  async assembleAndVerify() {
    if (this._result) {
      return {
        ...this._result,
        bytes: this._result.bytes.slice(),
        sha256: this._result.sha256.slice(),
        metadata: cloneMetadata(this._result.metadata),
      }
    }
    if (this._verificationPromise) {
      return this._verificationPromise
    }

    assertProtocol(
      this._metadata !== null,
      'METADATA_REQUIRED',
      'Metadata must be received before reconstruction.',
    )
    assertProtocol(
      this.ready,
      'MISSING_CHUNKS',
      `The receiver has ${this.uniqueChunks} of ${this.totalChunks} chunks.`,
    )

    this._status = 'verifying'
    this._verificationPromise = (async () => {
      try {
        const orderedChunks = new Array(this._metadata.totalChunks)
        for (let chunkIndex = 0; chunkIndex < orderedChunks.length; chunkIndex += 1) {
          orderedChunks[chunkIndex] = this._chunks.get(chunkIndex)
        }
        const bytes = concatBytes(orderedChunks, this._metadata.size)
        validateImageBytes(bytes, this._metadata.mimeType)
        const actualHash = await sha256(bytes)
        assertProtocol(
          bytesEqual(actualHash, this._metadata.sha256),
          'SHA256_MISMATCH',
          'The reconstructed image failed SHA-256 verification.',
        )

        this._status = 'complete'
        this._result = {
          bytes,
          metadata: cloneMetadata(this._metadata),
          sessionId: encodeBase64Url(this._sessionId),
          sha256: actualHash,
          sha256Hex: bytesToHex(actualHash),
        }
        return {
          ...this._result,
          bytes: bytes.slice(),
          sha256: actualHash.slice(),
          metadata: cloneMetadata(this._metadata),
        }
      } catch (error) {
        this._status = 'error'
        throw error
      } finally {
        this._verificationPromise = null
      }
    })()
    return this._verificationPromise
  }
}

export function createOpticalTransferCollector(options) {
  return new OpticalTransferCollector(options)
}

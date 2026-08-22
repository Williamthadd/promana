export const PROTOCOL_MAGIC = 'PMOT'
export const PROTOCOL_VERSION = 1
export const QR_PAYLOAD_PREFIX = 'PMOT1:'

export const PACKET_TYPES = Object.freeze({
  METADATA: 1,
  DATA: 2,
  END: 3,
})

// V1 deliberately uses numbered source chunks. The low nibble in every
// packet's flags byte is reserved for a future erasure/FEC scheme.
export const FEC_SCHEMES = Object.freeze({
  NONE: 0,
})

export const IMAGE_MIME_TYPES = Object.freeze({
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  GIF: 'image/gif',
})

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(
  Object.values(IMAGE_MIME_TYPES),
)

export const MIME_TYPE_CODES = Object.freeze({
  [IMAGE_MIME_TYPES.PNG]: 1,
  [IMAGE_MIME_TYPES.JPEG]: 2,
  [IMAGE_MIME_TYPES.WEBP]: 3,
  [IMAGE_MIME_TYPES.GIF]: 4,
})

export const MIME_CODE_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(MIME_TYPE_CODES).map(([mimeType, code]) => [code, mimeType]),
  ),
)

export const SESSION_ID_BYTES = 16
export const SHA256_BYTES = 32
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MIN_CHUNK_SIZE = 128
export const MAX_CHUNK_SIZE = 1_200
export const MAX_FILENAME_BYTES = 180
export const MAX_QR_PAYLOAD_LENGTH = 2_048

export const OPTICAL_TRANSFER_CONFIG = Object.freeze({
  chunkSize: 600,
  fps: 8,
  metadataInterval: 12,
  qrErrorCorrection: 'M',
  maxFileSize: MAX_FILE_SIZE,
  fecScheme: FEC_SCHEMES.NONE,
})

export const COMMON_HEADER_BYTES = 24
export const CRC_BYTES = 4

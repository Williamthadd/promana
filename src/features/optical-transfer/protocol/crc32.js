import { asUint8Array } from './bytes.js'

const CRC32_TABLE = new Uint32Array(256)

for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  CRC32_TABLE[index] = value >>> 0
}

export function crc32(value) {
  const bytes = asUint8Array(value)
  let checksum = 0xffffffff

  for (const byte of bytes) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8)
  }

  return (checksum ^ 0xffffffff) >>> 0
}


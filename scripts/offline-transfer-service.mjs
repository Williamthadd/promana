/* global process */
import { createOfflineTransferService } from '../server/offline-transfer/index.js'

function parseMaxBytes(value) {
  if (!value) return undefined
  const maxBytes = Number(value)
  if (!Number.isInteger(maxBytes) || maxBytes < 1024) {
    throw new Error('PROMANA_OFFLINE_MAX_BYTES must be an integer of at least 1024 bytes.')
  }
  return maxBytes
}

function allowedOriginsFromEnvironment() {
  const configured = String(process.env.PROMANA_OFFLINE_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  return configured.length > 0 ? configured : undefined
}

const service = createOfflineTransferService({
  allowedOrigins: allowedOriginsFromEnvironment(),
  registryOptions: {
    maxFileBytes: parseMaxBytes(process.env.PROMANA_OFFLINE_MAX_BYTES),
  },
})

try {
  const info = await service.start()
  console.log(`ProMana Offline QR Download service is ready at ${info.controlUrl}.`)
  if (info.networks.length > 0) {
    console.log(`Local network address${info.networks.length === 1 ? '' : 'es'}: ${info.networks.map(network => network.address).join(', ')}`)
  } else {
    console.warn('No private IPv4 LAN address was found. Connect to Wi-Fi, Ethernet, or a phone hotspot before creating a transfer.')
  }
  console.log(`Allowed ProMana origin${info.allowedOrigins.length === 1 ? '' : 's'}: ${info.allowedOrigins.join(', ')}`)
} catch (error) {
  console.error(`Could not start the ProMana Offline QR Download service: ${error.message}`)
  await service.close()
  process.exitCode = 1
}

let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  await service.close()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

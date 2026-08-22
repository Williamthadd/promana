const LOCAL_TRANSFER_ORIGIN = 'http://127.0.0.1:47832'
const HEALTH_TIMEOUT_MS = 2_500
const REQUEST_TIMEOUT_MS = 30_000
const EXPECTED_PROTOCOL = 'promana-offline-transfer'
const EXPECTED_PROTOCOL_VERSION = 1

export const OFFLINE_TRANSFER_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function normalizeImageMimeType(value) {
  const mimeType = String(value || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()

  return mimeType === 'image/jpg' || mimeType === 'image/pjpeg'
    ? 'image/jpeg'
    : mimeType
}

const TRANSFER_STATUSES = new Set([
  'preparing',
  'ready',
  'connecting',
  'transferring',
  'completed',
  'expired',
  'cancelled',
  'error',
])

function isPrivateIpv4Address(value) {
  const parts = String(value ?? '').split('.').map(Number)

  if (
    parts.length !== 4 ||
    parts.some(
      (part) => !Number.isInteger(part) || part < 0 || part > 255,
    )
  ) {
    return false
  }

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

function normalizeNetwork(network, index) {
  const address =
    typeof network === 'string' ? network : String(network?.address ?? '')

  if (!isPrivateIpv4Address(address)) {
    return null
  }

  const name =
    typeof network === 'object' && network?.name
      ? String(network.name).slice(0, 80)
      : `Local network ${index + 1}`

  return { address, name }
}

function normalizeNetworks(payload) {
  const candidates = Array.isArray(payload?.networks)
    ? payload.networks
    : Array.isArray(payload?.networkAddresses)
      ? payload.networkAddresses
      : []
  const seen = new Set()

  return candidates
    .map(normalizeNetwork)
    .filter((network) => {
      if (!network || seen.has(network.address)) {
        return false
      }

      seen.add(network.address)
      return true
    })
}

function normalizeTimestamp(value) {
  const numericValue = Number(value)

  if (Number.isFinite(numericValue) && numericValue > Date.now() - 86_400_000) {
    return numericValue
  }

  const parsedValue = Date.parse(String(value ?? ''))
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function assertLocalTransferUrl(value) {
  let transferUrl

  try {
    transferUrl = new URL(String(value ?? ''))
  } catch {
    throw new Error('The local transfer service returned an invalid QR address.')
  }

  if (
    transferUrl.protocol !== 'http:' ||
    !isPrivateIpv4Address(transferUrl.hostname) ||
    transferUrl.port !== '47832' ||
    !transferUrl.pathname.startsWith('/t/') ||
    !transferUrl.searchParams.has('token')
  ) {
    throw new Error('The transfer service did not return a safe local-network URL.')
  }

  return transferUrl.toString()
}

function normalizeSession(payload) {
  const id = String(payload?.id ?? '')
  const size = Number(payload?.size)
  const bytesTransferred = Number(
    payload?.bytesTransferred ?? payload?.transferredBytes ?? 0,
  )
  const status = String(payload?.status ?? 'preparing').toLowerCase()
  const expiresAt = normalizeTimestamp(payload?.expiresAt)

  if (
    payload?.protocol !== EXPECTED_PROTOCOL ||
    payload?.protocolVersion !== EXPECTED_PROTOCOL_VERSION
  ) {
    throw new Error(
      'The process on the Offline QR port is not a compatible ProMana Local Transfer Service.',
    )
  }

  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(id)) {
    throw new Error('The local transfer service returned an invalid session.')
  }

  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('The local transfer service returned an invalid image size.')
  }

  if (!TRANSFER_STATUSES.has(status)) {
    throw new Error('The local transfer service returned an unknown status.')
  }

  const localUrl = payload?.localUrl
    ? assertLocalTransferUrl(payload.localUrl)
    : ''

  if (!localUrl && !['completed', 'expired', 'cancelled', 'error'].includes(status)) {
    throw new Error('The local transfer service did not return a QR address.')
  }

  return {
    id,
    localUrl,
    filename: String(payload?.filename ?? 'image').slice(0, 255),
    mimeType: String(payload?.mimeType ?? ''),
    size,
    expiresAt,
    status,
    bytesTransferred: Number.isFinite(bytesTransferred)
      ? Math.max(0, Math.min(size, bytesTransferred))
      : 0,
    localAddress: String(payload?.localAddress ?? ''),
    networks: normalizeNetworks(payload),
  }
}

async function requestLocalService(
  path,
  { timeout = REQUEST_TIMEOUT_MS, ...options } = {},
) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${LOCAL_TRANSFER_ORIGIN}${path}`, {
      cache: 'no-store',
      credentials: 'omit',
      ...options,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const responseError =
        typeof payload?.error === 'object' ? payload.error : null
      const requestError = new Error(
        responseError?.message ||
          (typeof payload?.error === 'string' ? payload.error : '') ||
          'The local transfer service could not complete the request.',
      )
      requestError.status = response.status
      requestError.code = responseError?.code || payload?.code
      throw requestError
    }

    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The local transfer service did not respond in time.')
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Offline QR transfer is unavailable. Start the ProMana Local Transfer Service, then allow browser Local Network Access if prompted.',
      )
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function checkOfflineTransferAvailability() {
  try {
    const payload = await requestLocalService('/health', {
      timeout: HEALTH_TIMEOUT_MS,
    })
    const networks = normalizeNetworks(payload)
    const preferredAddress = String(
      payload?.preferredAddress ?? payload?.localAddress ?? '',
    )

    if (
      payload?.protocol !== EXPECTED_PROTOCOL ||
      payload?.protocolVersion !== EXPECTED_PROTOCOL_VERSION
    ) {
      throw new Error(
        'Port 47832 is occupied by an incompatible local service. Stop that process before starting ProMana Offline QR.',
      )
    }

    if (payload?.available === false || payload?.status !== 'ok') {
      throw new Error(
        payload?.error || 'The local transfer service is not ready.',
      )
    }

    if (!networks.length) {
      throw new Error(
        'No private Wi-Fi or hotspot address was found on this computer.',
      )
    }

    return {
      available: true,
      networks,
      preferredAddress: networks.some(
        (network) => network.address === preferredAddress,
      )
        ? preferredAddress
        : networks[0].address,
    }
  } catch (error) {
    return {
      available: false,
      networks: [],
      preferredAddress: '',
      error:
        error?.message ||
        'Offline QR transfer is unavailable on this device.',
    }
  }
}

export async function createOfflineTransfer({
  blob,
  filename,
  mimeType,
  networkAddress,
}) {
  const resolvedMimeType = normalizeImageMimeType(mimeType || blob?.type)

  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('The selected image is empty or unavailable.')
  }

  if (!OFFLINE_TRANSFER_IMAGE_TYPES.has(resolvedMimeType)) {
    throw new Error('Offline QR supports JPG, PNG, WEBP, and GIF images only.')
  }

  if (!isPrivateIpv4Address(networkAddress)) {
    throw new Error('Choose a valid private Wi-Fi or hotspot network.')
  }

  const payload = await requestLocalService('/api/transfers', {
    method: 'POST',
    headers: {
      'Content-Type': resolvedMimeType,
      'X-ProMana-Filename': encodeURIComponent(String(filename || 'image')),
      'X-ProMana-Filename-Encoding': 'percent',
      'X-ProMana-Mime-Type': resolvedMimeType,
      'X-ProMana-Network-Address': networkAddress,
    },
    body: blob,
  })

  return normalizeSession(payload)
}

export async function getOfflineTransferStatus(id) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(String(id ?? ''))) {
    throw new Error('The offline transfer session is invalid.')
  }

  return normalizeSession(
    await requestLocalService(`/api/transfers/${encodeURIComponent(id)}`, {
      timeout: 5_000,
    }),
  )
}

export async function cancelOfflineTransfer(id, { keepalive = false } = {}) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(String(id ?? ''))) {
    return
  }

  await requestLocalService(`/api/transfers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    keepalive,
    timeout: 5_000,
  })
}

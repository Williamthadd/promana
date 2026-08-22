import { Buffer } from 'node:buffer'
import http from 'node:http'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { URL } from 'node:url'
import {
  createContentDisposition,
  decodeFilenameHeader,
  escapeHtml,
  isValidSessionId,
  OfflineTransferError,
} from './security.js'
import {
  isLoopbackAddress,
  listPrivateIPv4Interfaces,
  selectPrivateIPv4Address,
} from './localNetwork.js'
import { TransferRegistry } from './transferRegistry.js'

const DEFAULT_PORT = 47_832
const PROTOCOL_NAME = 'promana-offline-transfer'
const PROTOCOL_VERSION = 1
const DEFAULT_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const CONTROL_HEADERS = [
  'content-type',
  'x-promana-filename',
  'x-promana-filename-encoding',
  'x-promana-mime-type',
  'x-promana-lan-address',
  'x-promana-network-address',
].join(', ')

function setSecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(body)
}

function errorPayload(code, message) {
  return { error: { code, message } }
}

function receiverMessage(status) {
  if (status === 'expired') {
    return {
      title: 'Transfer expired',
      message: 'This ProMana transfer has expired. Ask the sender to generate a new QR code.',
    }
  }
  if (status === 'cancelled') {
    return {
      title: 'Transfer cancelled',
      message: 'This transfer is no longer available. Ask the sender to create a new transfer.',
    }
  }
  if (status === 'completed') {
    return {
      title: 'Download completed',
      message: 'This one-time ProMana transfer has already been downloaded.',
    }
  }
  return {
    title: 'Transfer unavailable',
    message: 'This ProMana transfer is no longer available.',
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function renderReceiverPage({ title, message, session, fileUrl }) {
  const fileSection = session && fileUrl
    ? `<div class="file"><strong>${escapeHtml(session.filename)}</strong><span>${escapeHtml(formatBytes(session.size))}</span></div>
       <a class="button" href="${escapeHtml(fileUrl)}">Download image</a>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)} - ProMana</title>
  <style>
    :root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#eef6ff;color:#182234}
    main{width:min(100%,420px);padding:28px;border-radius:22px;background:#fff;box-shadow:0 20px 55px rgba(31,91,157,.18);text-align:center}
    .mark{display:inline-grid;place-items:center;width:52px;height:52px;border-radius:16px;background:#4f7cff;color:#fff;font-size:24px;font-weight:800}
    h1{margin:18px 0 8px;font-size:1.45rem}p{margin:0;color:#526174;line-height:1.55}.file{margin:22px 0 14px;padding:14px;border:1px solid #dce8f6;border-radius:14px;text-align:left;overflow-wrap:anywhere}.file span{display:block;margin-top:4px;color:#64748b;font-size:.9rem}
    .button{display:block;padding:13px 18px;border-radius:12px;background:#4f7cff;color:#fff;text-decoration:none;font-weight:750}.hint{margin-top:20px;font-size:.82rem;color:#718096}
    @media(prefers-color-scheme:dark){body{background:#101827;color:#ecf4ff}main{background:#182335;box-shadow:none}.file{border-color:#33445d}p,.file span,.hint{color:#aebdd1}}
  </style>
</head>
<body><main><div class="mark">P</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${fileSection}<p class="hint">The image travels directly over your local network. Internet access is not required.</p></main></body>
</html>`
}

function sendReceiverPage(response, statusCode, options, headOnly = false) {
  const body = renderReceiverPage(options)
  setSecurityHeaders(response)
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(headOnly ? undefined : body)
}

export function createInvalidTokenRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? 60_000
  const limit = options.limit ?? 60
  const maximumEntries = options.maximumEntries ?? 500
  const now = options.now || Date.now
  const attempts = new Map()

  return function recordInvalidAttempt(address) {
    const key = String(address || 'unknown')
    const currentTime = now()
    let entry = attempts.get(key)
    if (!entry || currentTime - entry.startedAt >= windowMs) {
      entry = { startedAt: currentTime, count: 0 }
      attempts.set(key, entry)
    }
    entry.count += 1

    if (attempts.size > maximumEntries) {
      for (const [candidate, candidateEntry] of attempts) {
        if (currentTime - candidateEntry.startedAt >= windowMs) attempts.delete(candidate)
      }
      while (attempts.size > maximumEntries) {
        attempts.delete(attempts.keys().next().value)
      }
    }

    return entry.count > limit
  }
}

function normalizeAllowedOrigins(origins) {
  return new Set((origins || DEFAULT_ORIGINS).map(origin => {
    try {
      return new URL(origin).origin
    } catch {
      return ''
    }
  }).filter(Boolean))
}

function isControlPath(pathname) {
  return pathname === '/health' || pathname === '/api/transfers' || pathname.startsWith('/api/transfers/')
}

function statusForUnavailableSession(session) {
  if (!session) return null
  return ['expired', 'cancelled', 'completed', 'error'].includes(session.status)
    ? session.status
    : null
}

export function createOfflineTransferService(options = {}) {
  const host = options.host || '0.0.0.0'
  const requestedPort = options.port ?? DEFAULT_PORT
  const allowedOrigins = normalizeAllowedOrigins(options.allowedOrigins)
  const registry = options.registry || new TransferRegistry(options.registryOptions)
  const networkProvider = options.networkProvider || listPrivateIPv4Interfaces
  const recordInvalidTokenAttempt = options.recordInvalidTokenAttempt
    || createInvalidTokenRateLimiter(options.invalidTokenRateLimit)
  let boundPort = null
  let started = false

  function currentNetworks() {
    const provided = networkProvider() || []
    if (Array.isArray(provided)) return provided
    return listPrivateIPv4Interfaces(provided)
  }

  function applyControlCors(request, response) {
    const origin = request.headers.origin
    if (!origin || !allowedOrigins.has(origin)) return false

    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', CONTROL_HEADERS)
    response.setHeader('Access-Control-Max-Age', '600')
    response.setHeader('Vary', 'Origin')
    if (request.headers['access-control-request-private-network'] === 'true') {
      response.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
    return true
  }

  function isValidControlRequest(request) {
    if (!isLoopbackAddress(request.socket.remoteAddress)) return false
    const hostHeader = String(request.headers.host || '').toLowerCase()
    return hostHeader === `127.0.0.1:${boundPort}`
      || hostHeader === `localhost:${boundPort}`
  }

  async function handleControlRequest(request, response, url) {
    if (!isValidControlRequest(request)) {
      sendJson(response, 404, errorPayload('NOT_FOUND', 'Not found.'))
      return
    }

    if (!applyControlCors(request, response)) {
      sendJson(response, 403, errorPayload('ORIGIN_NOT_ALLOWED', 'This ProMana origin is not allowed to control local transfers.'))
      return
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const networks = currentNetworks()
    const preferredNetwork = selectPrivateIPv4Address(networks)

    if (url.pathname === '/health' && request.method === 'GET') {
      sendJson(response, 200, {
        protocol: PROTOCOL_NAME,
        protocolVersion: PROTOCOL_VERSION,
        status: 'ok',
        available: Boolean(preferredNetwork),
        networks,
        networkAddresses: networks.map(network => network.address),
        preferredAddress: preferredNetwork?.address || null,
        localAddress: preferredNetwork?.address || null,
        port: boundPort,
      })
      return
    }

    if (url.pathname === '/api/transfers' && request.method === 'POST') {
      const requestedAddress = request.headers['x-promana-lan-address']
        || request.headers['x-promana-network-address']
      const selectedNetwork = selectPrivateIPv4Address(networks, requestedAddress)
      if (!selectedNetwork) {
        sendJson(response, 503, errorPayload(
          'NO_LAN_ADDRESS',
          'No usable private IPv4 network was found. Connect this computer and phone to the same Wi-Fi network or hotspot.',
        ))
        return
      }

      const declaredLength = Number(request.headers['content-length'])
      const filename = decodeFilenameHeader(
        request.headers['x-promana-filename'],
        request.headers['x-promana-filename-encoding'],
      )
      const mimeType = request.headers['x-promana-mime-type'] || request.headers['content-type']
      const transfer = await registry.createTransfer({
        source: request,
        filename,
        mimeType,
        sizeHint: Number.isFinite(declaredLength) ? declaredLength : undefined,
        localAddress: selectedNetwork.address,
        port: boundPort,
      })
      transfer.networkAddresses = networks.map(network => network.address)
      transfer.protocol = PROTOCOL_NAME
      transfer.protocolVersion = PROTOCOL_VERSION
      sendJson(response, 201, transfer)
      return
    }

    const match = url.pathname.match(/^\/api\/transfers\/([A-Za-z0-9_-]+)$/)
    if (match && isValidSessionId(match[1])) {
      if (request.method === 'GET') {
        const transfer = registry.getPublicSession(match[1], networks)
        if (!transfer) {
          sendJson(response, 404, errorPayload('TRANSFER_NOT_FOUND', 'Transfer not found.'))
          return
        }
        transfer.protocol = PROTOCOL_NAME
        transfer.protocolVersion = PROTOCOL_VERSION
        sendJson(response, 200, transfer)
        return
      }

      if (request.method === 'DELETE') {
        const cancelled = await registry.cancel(match[1])
        if (!cancelled) {
          sendJson(response, 404, errorPayload('TRANSFER_NOT_FOUND', 'Transfer not found.'))
          return
        }
        const transfer = registry.getPublicSession(match[1], networks)
        transfer.protocol = PROTOCOL_NAME
        transfer.protocolVersion = PROTOCOL_VERSION
        sendJson(response, 200, transfer)
        return
      }
    }

    sendJson(response, 404, errorPayload('NOT_FOUND', 'Not found.'))
  }

  async function handleReceiverPage(request, response, id, token) {
    const session = registry.getAuthorizedSession(id, token)
    if (!session) {
      const limited = recordInvalidTokenAttempt(request.socket.remoteAddress)
      sendReceiverPage(response, limited ? 429 : 404, receiverMessage(null), request.method === 'HEAD')
      return
    }

    const unavailableStatus = statusForUnavailableSession(session)
    if (unavailableStatus) {
      sendReceiverPage(response, 410, receiverMessage(unavailableStatus), request.method === 'HEAD')
      return
    }

    registry.markConnected(session)
    const fileUrl = `/t/${encodeURIComponent(id)}/file?token=${encodeURIComponent(token)}`
    sendReceiverPage(response, 200, {
      title: 'ProMana Offline Transfer',
      message: 'Tap below to download this image from the sender device.',
      session,
      fileUrl,
    }, request.method === 'HEAD')
  }

  async function handleFileDownload(request, response, id, token) {
    const session = registry.getAuthorizedSession(id, token)
    if (!session) {
      const limited = recordInvalidTokenAttempt(request.socket.remoteAddress)
      sendReceiverPage(response, limited ? 429 : 404, receiverMessage(null), request.method === 'HEAD')
      return
    }

    const unavailableStatus = statusForUnavailableSession(session)
    if (unavailableStatus) {
      sendReceiverPage(response, 410, receiverMessage(unavailableStatus), request.method === 'HEAD')
      return
    }

    if (request.method === 'HEAD') {
      registry.markConnected(session)
      setSecurityHeaders(response)
      response.setHeader('Content-Type', session.mimeType)
      response.setHeader('Content-Disposition', createContentDisposition(session.filename))
      response.setHeader('Content-Length', String(session.size))
      response.setHeader('Accept-Ranges', 'none')
      response.writeHead(200)
      response.end()
      return
    }

    const abortController = new AbortController()
    if (!registry.beginDownload(session, () => abortController.abort())) {
      sendReceiverPage(response, 409, {
        title: 'Transfer busy',
        message: 'This one-time image transfer is already in progress.',
      })
      return
    }

    setSecurityHeaders(response)
    response.setHeader('Content-Type', session.mimeType)
    response.setHeader('Content-Disposition', createContentDisposition(session.filename))
    response.setHeader('Content-Length', String(session.size))
    response.setHeader('Accept-Ranges', 'none')

    let bytesTransferred = 0
    const progress = new Transform({
      transform(chunk, _encoding, callback) {
        bytesTransferred += chunk.length
        registry.updateProgress(session, bytesTransferred)
        callback(null, chunk)
      },
    })

    try {
      response.writeHead(200)
      await pipeline(
        registry.createReadStream(session),
        progress,
        response,
        { signal: abortController.signal },
      )
      registry.completeDownload(session, bytesTransferred)
      await registry.sweep()
    } catch {
      registry.failDownload(session)
      if (!response.headersSent && !response.destroyed) {
        sendReceiverPage(response, 500, {
          title: 'Download interrupted',
          message: 'The local transfer was interrupted. Return to the QR page and try again.',
        })
      } else if (!response.destroyed) {
        response.destroy()
      }
    }
  }

  async function handleRequest(request, response) {
    const url = new URL(request.url || '/', 'http://127.0.0.1')

    if (isControlPath(url.pathname)) {
      await handleControlRequest(request, response, url)
      return
    }

    const pageMatch = url.pathname.match(/^\/t\/([A-Za-z0-9_-]+)$/)
    if (pageMatch && ['GET', 'HEAD'].includes(request.method)) {
      await handleReceiverPage(request, response, pageMatch[1], url.searchParams.get('token'))
      return
    }

    const fileMatch = url.pathname.match(/^\/t\/([A-Za-z0-9_-]+)\/file$/)
    if (fileMatch && ['GET', 'HEAD'].includes(request.method)) {
      await handleFileDownload(request, response, fileMatch[1], url.searchParams.get('token'))
      return
    }

    sendReceiverPage(response, 404, receiverMessage(null))
  }

  const server = http.createServer({
    maxHeaderSize: 16 * 1024,
    requestTimeout: 5 * 60 * 1000,
    headersTimeout: 10_000,
    keepAliveTimeout: 5_000,
  }, (request, response) => {
    void handleRequest(request, response).catch(error => {
      if (response.headersSent || response.destroyed) {
        response.destroy()
        return
      }

      if (error instanceof OfflineTransferError) {
        sendJson(response, error.statusCode, errorPayload(error.code, error.message))
        return
      }

      sendJson(response, 500, errorPayload(
        'LOCAL_TRANSFER_ERROR',
        'The local transfer service could not complete that request.',
      ))
    })
  })
  server.maxRequestsPerSocket = 100

  async function start() {
    if (started) return getInfo()
    await registry.initialize()

    await new Promise((resolve, reject) => {
      const onError = error => {
        server.off('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        const address = server.address()
        boundPort = typeof address === 'object' && address ? address.port : requestedPort
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(requestedPort, host)
    })
    started = true
    await registry.cleanupStaleTempDirectories?.()
    return getInfo()
  }

  function getInfo() {
    const networks = currentNetworks()
    return {
      host,
      port: boundPort,
      controlUrl: boundPort ? `http://127.0.0.1:${boundPort}` : null,
      networks,
      allowedOrigins: [...allowedOrigins],
    }
  }

  async function close() {
    await registry.dispose()
    if (started) {
      await new Promise(resolve => server.close(resolve))
      started = false
    }
    boundPort = null
  }

  return { start, close, getInfo, server, registry }
}

export { DEFAULT_ORIGINS, DEFAULT_PORT }

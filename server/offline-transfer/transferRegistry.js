import { Buffer } from 'node:buffer'
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  assertImageSignature,
  generateSessionCredentials,
  hashAccessToken,
  isValidSessionId,
  normalizeImageMimeType,
  OfflineTransferError,
  sanitizeFilename,
  verifyAccessToken,
} from './security.js'

const DEFAULT_TTL_MS = 10 * 60 * 1000
const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024
const DEFAULT_TOMBSTONE_MS = 2 * 60 * 1000
const DEFAULT_STALE_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1_000
const TEMP_DIRECTORY_PREFIX = 'promana-offline-transfer-'

function createUploadInspector(maxBytes) {
  let bytesReceived = 0
  let signature = Buffer.alloc(0)

  const stream = new Transform({
    transform(chunk, _encoding, callback) {
      bytesReceived += chunk.length
      if (bytesReceived > maxBytes) {
        callback(new OfflineTransferError(
          'IMAGE_TOO_LARGE',
          `The image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB local transfer limit.`,
          413,
        ))
        return
      }

      if (signature.length < 16) {
        signature = Buffer.concat([signature, chunk.subarray(0, 16 - signature.length)])
      }

      callback(null, chunk)
    },
  })

  return {
    stream,
    result: () => ({ bytesReceived, signature }),
  }
}

export class TransferRegistry {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
    this.tombstoneMs = options.tombstoneMs ?? DEFAULT_TOMBSTONE_MS
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 5_000
    this.now = options.now || Date.now
    this.tempRoot = path.resolve(options.tempRoot || os.tmpdir())
    this.requestedTempDirectory = options.tempDirectory || null
    this.tempDirectory = null
    this.ownsTempDirectory = !options.tempDirectory
    this.staleTempMaxAgeMs = options.staleTempMaxAgeMs
      ?? DEFAULT_STALE_TEMP_MAX_AGE_MS
    this.sessions = new Map()
    this.cleanupTimer = null
    this.createQueue = Promise.resolve()
  }

  async initialize() {
    if (this.tempDirectory) return this.tempDirectory

    if (this.requestedTempDirectory) {
      this.tempDirectory = path.resolve(this.requestedTempDirectory)
      await mkdir(this.tempDirectory, { recursive: true, mode: 0o700 })
    } else {
      await mkdir(this.tempRoot, { recursive: true, mode: 0o700 })
      this.tempDirectory = await mkdtemp(path.join(this.tempRoot, TEMP_DIRECTORY_PREFIX))
    }

    if (this.cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        void this.sweep()
      }, this.cleanupIntervalMs)
      this.cleanupTimer.unref?.()
    }

    return this.tempDirectory
  }

  async cleanupStaleTempDirectories() {
    if (!this.ownsTempDirectory || this.staleTempMaxAgeMs <= 0) return

    const root = this.tempRoot
    const currentDirectory = this.tempDirectory
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      if (
        !entry.name.startsWith(TEMP_DIRECTORY_PREFIX)
        || !entry.isDirectory()
        || entry.isSymbolicLink()
      ) continue

      const candidate = path.resolve(root, entry.name)
      if (candidate === currentDirectory || path.dirname(candidate) !== root) continue

      const candidateStats = await lstat(candidate).catch(() => null)
      if (
        !candidateStats
        || !candidateStats.isDirectory()
        || candidateStats.isSymbolicLink()
        || this.now() - candidateStats.mtimeMs < this.staleTempMaxAgeMs
      ) continue

      await rm(candidate, { recursive: true, force: true, maxRetries: 1 }).catch(() => {})
    }
  }

  async createTransfer({ source, filename, mimeType, sizeHint, localAddress, port }) {
    const previousCreate = this.createQueue
    let releaseCreate
    this.createQueue = new Promise(resolve => {
      releaseCreate = resolve
    })

    await previousCreate

    try {
      return await this.createTransferSerially({
        source,
        filename,
        mimeType,
        sizeHint,
        localAddress,
        port,
      })
    } finally {
      releaseCreate()
    }
  }

  async createTransferSerially({ source, filename, mimeType, sizeHint, localAddress, port }) {
    await this.initialize()

    const normalizedMimeType = normalizeImageMimeType(mimeType)
    const safeFilename = sanitizeFilename(filename, normalizedMimeType)
    const parsedSizeHint = Number(sizeHint)
    if (Number.isFinite(parsedSizeHint) && parsedSizeHint > this.maxFileBytes) {
      throw new OfflineTransferError(
        'IMAGE_TOO_LARGE',
        `The image exceeds the ${Math.floor(this.maxFileBytes / (1024 * 1024))} MB local transfer limit.`,
        413,
      )
    }

    const { id, token } = generateSessionCredentials()
    const filePath = path.join(this.tempDirectory, `${id}.image`)
    const createdAt = this.now()
    const session = {
      id,
      accessToken: token,
      tokenDigest: hashAccessToken(token),
      filename: safeFilename,
      mimeType: normalizedMimeType,
      size: 0,
      filePath,
      localAddress,
      port,
      createdAt,
      expiresAt: createdAt + this.ttlMs,
      status: 'preparing',
      bytesTransferred: 0,
      activeDownload: false,
      abortDownload: null,
      cleanupAt: null,
      purgeAt: null,
    }
    const inspector = createUploadInspector(this.maxFileBytes)
    try {
      await pipeline(
        source,
        inspector.stream,
        createWriteStream(filePath, { flags: 'wx', mode: 0o600 }),
      )

      const { bytesReceived, signature } = inspector.result()
      if (bytesReceived === 0) {
        throw new OfflineTransferError('EMPTY_IMAGE', 'The selected image is empty.', 400)
      }

      assertImageSignature(signature, normalizedMimeType)
      session.size = bytesReceived
      session.status = 'ready'
      await this.cancelActiveTransfers()
      this.sessions.set(id, session)
      return this.toPublicSession(session)
    } catch (error) {
      await rm(filePath, { force: true }).catch(() => {})
      throw error
    }
  }

  toPublicSession(session, networkAddresses = []) {
    const canShare = Boolean(session.accessToken)
      && ['preparing', 'ready', 'connecting', 'transferring'].includes(session.status)
    const localUrl = canShare
      ? `http://${session.localAddress}:${session.port}/t/${session.id}?token=${encodeURIComponent(session.accessToken)}`
      : null

    return {
      id: session.id,
      localUrl,
      filename: session.filename,
      mimeType: session.mimeType,
      size: session.size,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      status: session.status,
      bytesTransferred: session.bytesTransferred,
      networkAddresses: networkAddresses.map(entry => entry.address),
      localAddress: session.localAddress,
    }
  }

  getSession(id) {
    if (!isValidSessionId(id)) return null
    const session = this.sessions.get(id) || null
    if (session) this.expireIfNeeded(session)
    return session
  }

  getPublicSession(id, networkAddresses = []) {
    const session = this.getSession(id)
    return session ? this.toPublicSession(session, networkAddresses) : null
  }

  getAuthorizedSession(id, token) {
    const session = this.getSession(id)
    if (!session || !verifyAccessToken(token, session.tokenDigest)) return null
    return session
  }

  markConnected(session) {
    this.expireIfNeeded(session)
    if (session.status === 'ready') session.status = 'connecting'
    return session.status
  }

  beginDownload(session, abortDownload) {
    this.expireIfNeeded(session)
    if (!['ready', 'connecting'].includes(session.status) || session.activeDownload) {
      return false
    }

    session.status = 'transferring'
    session.bytesTransferred = 0
    session.activeDownload = true
    session.abortDownload = abortDownload
    return true
  }

  updateProgress(session, bytesTransferred) {
    if (session.status === 'transferring') {
      session.bytesTransferred = Math.min(bytesTransferred, session.size)
    }
  }

  completeDownload(session, bytesTransferred) {
    if (session.status !== 'transferring') return

    session.activeDownload = false
    session.abortDownload = null
    session.bytesTransferred = Math.min(bytesTransferred, session.size)

    if (bytesTransferred === session.size) {
      session.status = 'completed'
      session.cleanupAt = this.now()
      session.purgeAt = this.now() + this.tombstoneMs
    } else {
      session.status = 'ready'
      session.bytesTransferred = 0
    }
  }

  failDownload(session) {
    if (session.status !== 'transferring') return
    session.activeDownload = false
    session.abortDownload = null
    session.status = 'ready'
    session.bytesTransferred = 0
  }

  async cancel(id) {
    const session = this.getSession(id)
    if (!session) return false
    if (['cancelled', 'expired'].includes(session.status)) return true

    session.status = 'cancelled'
    session.abortDownload?.()
    session.activeDownload = false
    session.abortDownload = null
    session.cleanupAt = this.now()
    session.purgeAt = this.now() + this.tombstoneMs
    await this.removeSessionFile(session)
    return true
  }

  async cancelActiveTransfers() {
    const active = [...this.sessions.values()]
      .filter(session => ['preparing', 'ready', 'connecting', 'transferring'].includes(session.status))
    await Promise.all(active.map(session => this.cancel(session.id)))
  }

  expireIfNeeded(session) {
    if (
      this.now() < session.expiresAt
      || ['completed', 'expired', 'cancelled', 'error'].includes(session.status)
    ) {
      return false
    }

    session.status = 'expired'
    session.abortDownload?.()
    session.activeDownload = false
    session.abortDownload = null
    session.cleanupAt = this.now()
    session.purgeAt = this.now() + this.tombstoneMs
    void this.removeSessionFile(session)
    return true
  }

  async removeSessionFile(session) {
    await rm(session.filePath, { force: true }).catch(() => {})
    session.accessToken = null
  }

  async sweep() {
    const currentTime = this.now()

    for (const [id, session] of this.sessions) {
      this.expireIfNeeded(session)

      if (session.cleanupAt !== null && currentTime >= session.cleanupAt) {
        await this.removeSessionFile(session)
        session.cleanupAt = null
      }

      if (session.purgeAt !== null && currentTime >= session.purgeAt) {
        this.sessions.delete(id)
      }
    }
  }

  createReadStream(session) {
    return createReadStream(session.filePath)
  }

  async dispose() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    for (const session of this.sessions.values()) {
      session.status = 'cancelled'
      session.abortDownload?.()
      await this.removeSessionFile(session)
    }
    this.sessions.clear()

    if (this.ownsTempDirectory && this.tempDirectory) {
      await rm(this.tempDirectory, { recursive: true, force: true }).catch(() => {})
    }
    this.tempDirectory = null
  }
}

export const OFFLINE_TRANSFER_DEFAULTS = Object.freeze({
  ttlMs: DEFAULT_TTL_MS,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
})

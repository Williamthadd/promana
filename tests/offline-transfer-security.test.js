import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  assertImageSignature,
  createContentDisposition,
  createInvalidTokenRateLimiter,
  decodeFilenameHeader,
  generateSessionCredentials,
  hashAccessToken,
  isPrivateIPv4,
  listPrivateIPv4Interfaces,
  sanitizeFilename,
  OFFLINE_TRANSFER_DEFAULTS,
  TransferRegistry,
  verifyAccessToken,
} from '../server/offline-transfer/index.js'

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('offline-image-payload'),
])

test('session credentials are cryptographically sized, unique, and timing-safe verifiable', () => {
  const credentials = Array.from({ length: 256 }, generateSessionCredentials)
  assert.equal(new Set(credentials.map(value => value.id)).size, credentials.length)
  assert.equal(new Set(credentials.map(value => value.token)).size, credentials.length)

  for (const { id, token } of credentials) {
    assert.match(id, /^[A-Za-z0-9_-]{22}$/)
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    const digest = hashAccessToken(token)
    assert.equal(verifyAccessToken(token, digest), true)
    assert.equal(verifyAccessToken(`${token.slice(0, -1)}x`, digest), false)
  }
})

test('invalid-token throttling is bounded per receiver address and resets by time window', () => {
  let now = 5_000
  const recordInvalidAttempt = createInvalidTokenRateLimiter({
    limit: 2,
    windowMs: 100,
    maximumEntries: 2,
    now: () => now,
  })

  assert.equal(recordInvalidAttempt('192.168.1.2'), false)
  assert.equal(recordInvalidAttempt('192.168.1.2'), false)
  assert.equal(recordInvalidAttempt('192.168.1.2'), true)
  assert.equal(recordInvalidAttempt('192.168.1.3'), false)
  assert.equal(recordInvalidAttempt('192.168.1.4'), false)
  now += 101
  assert.equal(recordInvalidAttempt('192.168.1.2'), false)
})

test('filenames are decoded, stripped of traversal/header characters, and receive a safe extension', () => {
  const decoded = decodeFilenameHeader(
    encodeURIComponent('../foto liburan\r\nInjected: yes.png'),
    'percent',
  )
  const filename = sanitizeFilename(decoded, 'image/png')
  assert.equal(filename, 'foto liburan__Injected_ yes.png')
  assert.doesNotMatch(filename, /[\r\n/\\]/)

  const unicodeFilename = sanitizeFilename('東京 vacation.exe', 'image/jpeg')
  assert.equal(unicodeFilename, '東京 vacation.jpg')
  const disposition = createContentDisposition(unicodeFilename)
  assert.match(disposition, /^attachment; filename="[\x20-\x7e]+";/)
  assert.match(disposition, /filename\*=UTF-8''/)
  assert.doesNotMatch(disposition, /[\r\n]/)

  assert.throws(
    () => decodeFilenameHeader('%E0%A4%A', 'percent'),
    error => error.code === 'INVALID_FILENAME_ENCODING',
  )
})

test('image type validation checks magic bytes instead of trusting a MIME header', () => {
  const samples = new Map([
    ['image/png', PNG_BYTES],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
    ['image/gif', Buffer.from('GIF89a-payload')],
    ['image/webp', Buffer.from('RIFF0000WEBPpayload')],
  ])

  for (const [mimeType, bytes] of samples) {
    assert.equal(assertImageSignature(bytes, mimeType), mimeType)
  }

  assert.throws(
    () => assertImageSignature(PNG_BYTES, 'image/jpeg'),
    error => error.code === 'IMAGE_SIGNATURE_MISMATCH' && error.statusCode === 415,
  )
  assert.throws(
    () => assertImageSignature(Buffer.from('<svg/>'), 'image/svg+xml'),
    error => error.code === 'UNSUPPORTED_IMAGE_TYPE' && error.statusCode === 415,
  )
})

test('LAN interface selection accepts only private IPv4 and deprioritizes virtual adapters', () => {
  assert.equal(isPrivateIPv4('10.0.0.8'), true)
  assert.equal(isPrivateIPv4('172.31.4.5'), true)
  assert.equal(isPrivateIPv4('192.168.1.9'), true)
  assert.equal(isPrivateIPv4('127.0.0.1'), false)
  assert.equal(isPrivateIPv4('169.254.2.4'), false)
  assert.equal(isPrivateIPv4('8.8.8.8'), false)

  const interfaces = listPrivateIPv4Interfaces({
    'vEthernet (WSL)': [{ family: 'IPv4', address: '172.20.1.1', internal: false }],
    WiFi: [{ family: 'IPv4', address: '192.168.50.10', internal: false }],
    Ethernet: [{ family: 4, address: '10.0.0.7', internal: false }],
    Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  })

  assert.deepEqual(interfaces[0], { name: 'WiFi', address: '192.168.50.10' })
  assert.equal(interfaces.some(entry => entry.name === 'vEthernet (WSL)'), false)
})

test('registry expiration and cancellation remove only generated temporary image files', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'promana-registry-test-'))
  let now = 10_000
  const registry = new TransferRegistry({
    tempDirectory,
    ttlMs: 100,
    tombstoneMs: 50,
    cleanupIntervalMs: 0,
    now: () => now,
  })

  try {
    const first = await registry.createTransfer({
      source: Readable.from(PNG_BYTES),
      filename: 'first.png',
      mimeType: 'image/png',
      sizeHint: PNG_BYTES.length,
      localAddress: '192.168.1.5',
      port: 47_832,
    })
    const firstPath = registry.getSession(first.id).filePath
    assert.equal((await stat(firstPath)).isFile(), true)

    assert.equal(await registry.cancel(first.id), true)
    await assert.rejects(stat(firstPath), error => error.code === 'ENOENT')
    assert.equal(registry.getSession(first.id).status, 'cancelled')

    const second = await registry.createTransfer({
      source: Readable.from(PNG_BYTES),
      filename: 'second.png',
      mimeType: 'image/png',
      localAddress: '192.168.1.5',
      port: 47_832,
    })
    const secondPath = registry.getSession(second.id).filePath
    now += 101
    await registry.sweep()
    assert.equal(registry.getSession(second.id).status, 'expired')
    await assert.rejects(stat(secondPath), error => error.code === 'ENOENT')

    now += 51
    await registry.sweep()
    assert.equal(registry.getSession(second.id), null)
  } finally {
    await registry.dispose()
    await rm(tempDirectory, { recursive: true, force: true })
  }
})

test('startup cleanup removes only stale ProMana transfer directories after the safety age', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'promana-stale-cleanup-test-'))
  const staleDirectory = path.join(tempRoot, 'promana-offline-transfer-stale-test')
  const unrelatedDirectory = path.join(tempRoot, 'unrelated-directory')
  const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1_000)
  const registry = new TransferRegistry({
    tempRoot,
    staleTempMaxAgeMs: 24 * 60 * 60 * 1_000,
    cleanupIntervalMs: 0,
  })

  try {
    await mkdir(staleDirectory)
    await writeFile(path.join(staleDirectory, 'orphan.image'), PNG_BYTES)
    await utimes(staleDirectory, oldTime, oldTime)
    await mkdir(unrelatedDirectory)

    const currentDirectory = await registry.initialize()
    await registry.cleanupStaleTempDirectories()

    await assert.rejects(stat(staleDirectory), error => error.code === 'ENOENT')
    assert.equal((await stat(unrelatedDirectory)).isDirectory(), true)
    assert.equal((await stat(currentDirectory)).isDirectory(), true)
  } finally {
    await registry.dispose()
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('registry rejects a declared image larger than ProMana\'s 25 MiB limit before streaming', async () => {
  const registry = new TransferRegistry({ cleanupIntervalMs: 0 })
  try {
    assert.equal(OFFLINE_TRANSFER_DEFAULTS.maxFileBytes, 25 * 1024 * 1024)
    await assert.rejects(
      registry.createTransfer({
        source: Readable.from(PNG_BYTES),
        filename: 'too-large.png',
        mimeType: 'image/png',
        sizeHint: OFFLINE_TRANSFER_DEFAULTS.maxFileBytes + 1,
        localAddress: '192.168.1.5',
        port: 47_832,
      }),
      error => error.code === 'IMAGE_TOO_LARGE' && error.statusCode === 413,
    )
  } finally {
    await registry.dispose()
  }

  const streamingRegistry = new TransferRegistry({
    cleanupIntervalMs: 0,
    maxFileBytes: 16,
  })
  try {
    await assert.rejects(
      streamingRegistry.createTransfer({
        source: Readable.from(PNG_BYTES),
        filename: 'chunked.png',
        mimeType: 'image/png',
        localAddress: '192.168.1.5',
        port: 47_832,
      }),
      error => error.code === 'IMAGE_TOO_LARGE' && error.statusCode === 413,
    )
    assert.equal(streamingRegistry.sessions.size, 0)
  } finally {
    await streamingRegistry.dispose()
  }
})

test('a failed replacement keeps the existing ready transfer available', async () => {
  const registry = new TransferRegistry({ cleanupIntervalMs: 0 })

  try {
    const existing = await registry.createTransfer({
      source: Readable.from(PNG_BYTES),
      filename: 'existing.png',
      mimeType: 'image/png',
      localAddress: '192.168.1.5',
      port: 47_832,
    })

    await assert.rejects(
      registry.createTransfer({
        source: Readable.from(Buffer.from('not-an-image')),
        filename: 'invalid.png',
        mimeType: 'image/png',
        localAddress: '192.168.1.5',
        port: 47_832,
      }),
      error => error.code === 'IMAGE_SIGNATURE_MISMATCH',
    )

    assert.equal(registry.getSession(existing.id).status, 'ready')
    assert.match(registry.getPublicSession(existing.id).localUrl, /^http:\/\//)
  } finally {
    await registry.dispose()
  }
})

test('concurrent creates are serialized and leave only the newest successful transfer active', async () => {
  const registry = new TransferRegistry({ cleanupIntervalMs: 0 })
  let releaseFirstChunk
  let markFirstChunkSent
  const firstChunkSent = new Promise(resolve => {
    markFirstChunkSent = resolve
  })
  const waitForRelease = new Promise(resolve => {
    releaseFirstChunk = resolve
  })

  async function* slowPng() {
    yield PNG_BYTES.subarray(0, 8)
    markFirstChunkSent()
    await waitForRelease
    yield PNG_BYTES.subarray(8)
  }

  try {
    const firstPromise = registry.createTransfer({
      source: Readable.from(slowPng()),
      filename: 'first.png',
      mimeType: 'image/png',
      localAddress: '192.168.1.5',
      port: 47_832,
    })
    await firstChunkSent

    const secondPromise = registry.createTransfer({
      source: Readable.from(PNG_BYTES),
      filename: 'second.png',
      mimeType: 'image/png',
      localAddress: '192.168.1.5',
      port: 47_832,
    })
    releaseFirstChunk()

    const [first, second] = await Promise.all([firstPromise, secondPromise])
    assert.equal(registry.getSession(first.id).status, 'cancelled')
    assert.equal(registry.getSession(second.id).status, 'ready')
    assert.equal(
      [...registry.sessions.values()].filter(session =>
        ['preparing', 'ready', 'connecting', 'transferring'].includes(session.status),
      ).length,
      1,
    )
  } finally {
    releaseFirstChunk?.()
    await registry.dispose()
  }
})

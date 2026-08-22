import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { stat } from 'node:fs/promises'
import test from 'node:test'
import { createOfflineTransferService } from '../server/offline-transfer/index.js'

const ALLOWED_ORIGIN = 'http://localhost:3000'
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('exact-local-transfer-bytes'),
])

async function startTestService(registryOptions = {}) {
  const service = createOfflineTransferService({
    host: '127.0.0.1',
    port: 0,
    allowedOrigins: [ALLOWED_ORIGIN],
    networkProvider: () => [{ name: 'Wi-Fi', address: '192.168.55.4' }],
    registryOptions: {
      cleanupIntervalMs: 0,
      ...registryOptions,
    },
  })
  const info = await service.start()
  return { service, baseUrl: info.controlUrl }
}

async function createTransfer(baseUrl, options = {}) {
  const filename = options.filename || 'holiday photo.png'
  return fetch(`${baseUrl}/api/transfers`, {
    method: 'POST',
    headers: {
      Origin: ALLOWED_ORIGIN,
      'Content-Type': options.mimeType || 'image/png',
      'X-ProMana-Mime-Type': options.mimeType || 'image/png',
      'X-ProMana-Filename': encodeURIComponent(filename),
      'X-ProMana-Filename-Encoding': 'percent',
    },
    body: options.bytes || PNG_BYTES,
  })
}

function receiverUrl(localUrl, suffix = '') {
  const parsed = new URL(localUrl)
  parsed.hostname = '127.0.0.1'
  if (suffix) parsed.pathname += suffix
  return parsed.toString()
}

async function assertFileRemovedSoon(filePath) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await stat(filePath)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  assert.fail('The completed transfer file was not removed promptly.')
}

test('control API is loopback-oriented, exact-origin CORS protected, and reports LAN choices', async t => {
  const { service, baseUrl } = await startTestService()
  t.after(() => service.close())

  const disallowed = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://attacker.example' },
  })
  assert.equal(disallowed.status, 403)
  assert.equal(disallowed.headers.get('access-control-allow-origin'), null)

  const preflight = await fetch(`${baseUrl}/api/transfers`, {
    method: 'OPTIONS',
    headers: {
      Origin: ALLOWED_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Private-Network': 'true',
    },
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN)
  assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true')

  const health = await fetch(`${baseUrl}/health`, { headers: { Origin: ALLOWED_ORIGIN } })
  assert.equal(health.status, 200)
  const payload = await health.json()
  assert.equal(payload.protocol, 'promana-offline-transfer')
  assert.equal(payload.protocolVersion, 1)
  assert.equal(payload.available, true)
  assert.equal(payload.preferredAddress, '192.168.55.4')
  assert.deepEqual(payload.networkAddresses, ['192.168.55.4'])
})

test('a valid image is streamed with exact safe attachment headers and becomes one-time completed', async t => {
  const { service, baseUrl } = await startTestService()
  t.after(() => service.close())

  const createdResponse = await createTransfer(baseUrl, { filename: '東京 holiday photo.png' })
  assert.equal(createdResponse.status, 201)
  const created = await createdResponse.json()
  assert.equal(created.protocol, 'promana-offline-transfer')
  assert.equal(created.protocolVersion, 1)
  const stagedFilePath = service.registry.getSession(created.id).filePath
  assert.equal(created.status, 'ready')
  assert.equal(created.filename, '東京 holiday photo.png')
  assert.equal(created.size, PNG_BYTES.length)
  assert.equal(created.localAddress, '192.168.55.4')
  assert.match(created.localUrl, /^http:\/\/192\.168\.55\.4:\d+\/t\//)
  assert.equal(Object.hasOwn(created, 'token'), false)

  const landingResponse = await fetch(receiverUrl(created.localUrl))
  assert.equal(landingResponse.status, 200)
  const landingHtml = await landingResponse.text()
  assert.match(landingHtml, /ProMana Offline Transfer/)
  assert.match(landingHtml, /Download image/)
  assert.doesNotMatch(landingHtml, /https:\/\//)

  const landingHead = await fetch(receiverUrl(created.localUrl), { method: 'HEAD' })
  assert.equal(landingHead.status, 200)
  assert.equal(await landingHead.text(), '')

  const downloadResponse = await fetch(receiverUrl(created.localUrl, '/file'))
  assert.equal(downloadResponse.status, 200)
  assert.equal(downloadResponse.headers.get('content-type'), 'image/png')
  assert.equal(Number(downloadResponse.headers.get('content-length')), PNG_BYTES.length)
  assert.match(downloadResponse.headers.get('content-disposition'), /^attachment;/)
  assert.match(downloadResponse.headers.get('content-disposition'), /filename\*=UTF-8''/)
  assert.deepEqual(Buffer.from(await downloadResponse.arrayBuffer()), PNG_BYTES)

  const statusResponse = await fetch(`${baseUrl}/api/transfers/${created.id}`, {
    headers: { Origin: ALLOWED_ORIGIN },
  })
  const status = await statusResponse.json()
  assert.equal(status.status, 'completed')
  assert.equal(status.bytesTransferred, PNG_BYTES.length)
  assert.equal(status.localUrl, null)
  await assertFileRemovedSoon(stagedFilePath)

  const secondDownload = await fetch(receiverUrl(created.localUrl, '/file'))
  assert.equal(secondDownload.status, 410)
  assert.match(await secondDownload.text(), /already been downloaded/i)
})

test('invalid tokens and arbitrary paths reveal neither file data nor metadata', async t => {
  const { service, baseUrl } = await startTestService()
  t.after(() => service.close())

  const created = await (await createTransfer(baseUrl, { filename: 'private-name.png' })).json()
  const invalidTokenUrl = new URL(receiverUrl(created.localUrl))
  invalidTokenUrl.searchParams.set('token', 'x'.repeat(43))
  const invalid = await fetch(invalidTokenUrl)
  assert.equal(invalid.status, 404)
  const invalidBody = await invalid.text()
  assert.doesNotMatch(invalidBody, /private-name/)
  assert.doesNotMatch(invalidBody, /exact-local-transfer-bytes/)

  const arbitrary = await fetch(`${baseUrl}/files/../../package.json`)
  assert.equal(arbitrary.status, 404)
  assert.doesNotMatch(await arbitrary.text(), /"dependencies"/)

  const wrongMime = await createTransfer(baseUrl, { mimeType: 'image/jpeg' })
  assert.equal(wrongMime.status, 415)
  assert.equal((await wrongMime.json()).error.code, 'IMAGE_SIGNATURE_MISMATCH')
})

test('sender cancellation immediately deletes bytes and returns a useful receiver state', async t => {
  const { service, baseUrl } = await startTestService()
  t.after(() => service.close())

  const created = await (await createTransfer(baseUrl)).json()
  const cancelResponse = await fetch(`${baseUrl}/api/transfers/${created.id}`, {
    method: 'DELETE',
    headers: { Origin: ALLOWED_ORIGIN },
  })
  assert.equal(cancelResponse.status, 200)
  const cancelled = await cancelResponse.json()
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.localUrl, null)

  const receiverResponse = await fetch(receiverUrl(created.localUrl))
  assert.equal(receiverResponse.status, 410)
  assert.match(await receiverResponse.text(), /no longer available/i)
})

test('expired sessions reject the original QR URL and are cleaned up', async t => {
  let now = 1000
  const { service, baseUrl } = await startTestService({
    ttlMs: 100,
    tombstoneMs: 50,
    now: () => now,
  })
  t.after(() => service.close())

  const created = await (await createTransfer(baseUrl)).json()
  now += 101
  await service.registry.sweep()

  const expiredReceiver = await fetch(receiverUrl(created.localUrl))
  assert.equal(expiredReceiver.status, 410)
  assert.match(await expiredReceiver.text(), /has expired/i)

  const status = await (await fetch(`${baseUrl}/api/transfers/${created.id}`, {
    headers: { Origin: ALLOWED_ORIGIN },
  })).json()
  assert.equal(status.status, 'expired')

  now += 51
  await service.registry.sweep()
  const purgedStatus = await fetch(`${baseUrl}/api/transfers/${created.id}`, {
    headers: { Origin: ALLOWED_ORIGIN },
  })
  assert.equal(purgedStatus.status, 404)
})

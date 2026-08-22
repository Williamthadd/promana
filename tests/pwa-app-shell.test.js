import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  collectPrecacheUrls,
  createServiceWorkerSource,
} from '../scripts/pwa-app-shell-plugin.js'

test('PWA manifest defines a scoped standalone application', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  )

  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'))
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'))
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes('maskable')))
  assert.ok(
    manifest.shortcuts.some((shortcut) => shortcut.url === '/receiver'),
    'the installed PWA must expose the public optical receiver',
  )
})

test('optical receiver is public and its decoder has no runtime network dependency', async () => {
  const [appSource, workerSource, cssSource] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(
      new URL(
        '../src/features/optical-transfer/receiver/qrDecode.worker.js',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ])

  assert.match(appSource, /path="\/receiver"/)
  assert.match(workerSource, /from 'jsqr'/)
  assert.doesNotMatch(workerSource, /https?:\/\//i)
  assert.doesNotMatch(workerSource, /\bfetch\s*\(/)
  assert.doesNotMatch(cssSource, /@import\s+url\(/i)
})

test('precache list includes emitted app assets but excludes source maps', () => {
  const bundle = {
    'assets/index-abc123.js': { type: 'chunk', code: 'export {}' },
    'assets/index-def456.css': { type: 'asset', source: 'body{}' },
    'assets/index-abc123.js.map': { type: 'asset', source: '{}' },
  }

  const urls = collectPrecacheUrls(bundle)

  assert.ok(urls.includes('/'))
  assert.ok(urls.includes('/index.html'))
  assert.ok(urls.includes('/assets/index-abc123.js'))
  assert.ok(urls.includes('/assets/index-def456.css'))
  assert.ok(urls.includes('/manifest.webmanifest'))
  assert.ok(urls.includes('/offline.html'))
  assert.ok(!urls.some((url) => url.endsWith('.map')))
})

test('generated worker is valid JavaScript and never caches API requests', () => {
  const source = createServiceWorkerSource({
    buildId: 'test-build',
    precacheUrls: ['/', '/index.html', '/assets/index.js'],
  })

  assert.doesNotThrow(() => new Function(source))
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(source, /request\.mode === 'navigate'/)
  assert.match(source, /promana-app-shell-test-build/)
})

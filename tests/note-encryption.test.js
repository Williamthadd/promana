// Hidden-note encryption regression tests (offline, node:test).
// Uses Web Crypto (available in Node 22+) and the in-memory key fallback
// (no localStorage in Node), so no browser or Firebase project is needed.

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENCRYPTED_NOTE_PREFIX,
  clearCachedNoteKeys,
  decryptNoteContent,
  encryptNoteContent,
  exportNoteKeyBackup,
  getOrCreateNoteKey,
  hasNoteKey,
  importNoteKey,
  isEncryptedNoteContent,
} from '../src/utils/noteEncryption.js'
import { filterNotesForAi } from '../src/utils/aiWorkspaceData.js'

test('plaintext is never mistaken for ciphertext', () => {
  assert.equal(isEncryptedNoteContent('hello world'), false)
  assert.equal(isEncryptedNoteContent(''), false)
  assert.equal(isEncryptedNoteContent(null), false)
  assert.equal(isEncryptedNoteContent(undefined), false)
  assert.equal(isEncryptedNoteContent('enc:v1:other:abc'), false)
})

test('encrypt produces the versioned payload format', async () => {
  clearCachedNoteKeys()
  const key = await getOrCreateNoteKey('user-a')
  const payload = await encryptNoteContent('SELECT 1;', key)

  assert.ok(payload.startsWith(ENCRYPTED_NOTE_PREFIX))
  assert.ok(isEncryptedNoteContent(payload))
  assert.ok(!payload.includes('SELECT 1;'))
})

test('encrypt/decrypt round-trips content exactly', async () => {
  clearCachedNoteKeys()
  const key = await getOrCreateNoteKey('user-b')
  const original = 'line one\nline two — unicode ✓\n`s3cr3t --flag=x`'

  assert.equal(await decryptNoteContent(await encryptNoteContent(original, key), key), original)
})

test('same plaintext encrypts to different ciphertexts (random IV)', async () => {
  clearCachedNoteKeys()
  const key = await getOrCreateNoteKey('user-c')

  const first = await encryptNoteContent('same text', key)
  const second = await encryptNoteContent('same text', key)

  assert.notEqual(first, second)
  assert.equal(await decryptNoteContent(first, key), 'same text')
  assert.equal(await decryptNoteContent(second, key), 'same text')
})

test('decryption fails with a different key', async () => {
  clearCachedNoteKeys()
  const keyOne = await getOrCreateNoteKey('user-d1')
  const keyTwo = await getOrCreateNoteKey('user-d2')
  const payload = await encryptNoteContent('top secret', keyOne)

  await assert.rejects(decryptNoteContent(payload, keyTwo))
})

test('tampered or malformed payloads are rejected', async () => {
  clearCachedNoteKeys()
  const key = await getOrCreateNoteKey('user-e')
  const payload = await encryptNoteContent('data', key)

  await assert.rejects(decryptNoteContent(`${payload}tampered`, key))
  await assert.rejects(decryptNoteContent(`${ENCRYPTED_NOTE_PREFIX}only-one-part`, key))
  await assert.rejects(decryptNoteContent('plain text', key))
})

test('key backup export/import restores decryption on a new device', async () => {
  clearCachedNoteKeys()
  const key = await getOrCreateNoteKey('user-f')
  const payload = await encryptNoteContent('portable secret', key)
  const backup = await exportNoteKeyBackup('user-f')

  assert.ok(typeof backup === 'string' && backup.length > 0)

  // Simulate a new device with an empty key store.
  clearCachedNoteKeys()
  assert.equal(hasNoteKey('user-f'), false)

  await importNoteKey('user-f', backup)
  assert.equal(hasNoteKey('user-f'), true)

  const restored = await getOrCreateNoteKey('user-f')
  assert.equal(await decryptNoteContent(payload, restored), 'portable secret')
})

test('invalid key backups are rejected before storing', async () => {
  clearCachedNoteKeys()

  await assert.rejects(importNoteKey('user-g', ''))
  await assert.rejects(importNoteKey('user-g', 'not-valid-base64!!!'))
  await assert.rejects(importNoteKey('user-g', 'c2hvcnQ'))
  assert.equal(hasNoteKey('user-g'), false)
})

test('hidden notes stay out of AI context (encryption complement)', () => {
  const notes = [
    { id: '1', visibility: 'visible', content: 'plain' },
    { id: '2', visibility: 'hidden', content: `${ENCRYPTED_NOTE_PREFIX}iv:ct` },
  ]

  assert.deepEqual(
    filterNotesForAi(notes).map((note) => note.id),
    ['1'],
  )
})

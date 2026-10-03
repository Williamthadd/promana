// Client-side encryption for hidden notes.
//
// Hidden notes (`visibility === 'hidden'`) store their `content` in Firestore
// as AES-GCM ciphertext (`enc:v1:aesgcm:<iv>:<ciphertext>`). Title, tags,
// type and visibility stay plaintext so listing, filtering and title search
// keep working, and hidden notes stay excluded from AI context.
//
// Key model: one random 256-bit data key per user, kept in this browser's
// localStorage (`promana-note-key:{uid}`). Firestore never sees the key, so
// database readers (console, backups) only see ciphertext. Consequences:
//  - Hidden notes only decrypt on devices holding the key. New devices show
//    a "locked" state until the key is imported (see export/import below).
//  - Losing the key (cleared site data, no backup) makes hidden-note
//    contents unrecoverable. Back it up via `exportNoteKeyBackup`.
//  - Same-origin XSS can read localStorage, so this protects data at rest,
//    not a compromised browser profile. Never paste the backup key into
//    untrusted pages.
//
// No custom cryptography: Web Crypto AES-GCM only. Works offline (key and
// ciphertext are both local); encryption happens before `queueFirestoreWrite`
// so offline-queued writes are ciphertext too.

export const ENCRYPTED_NOTE_PREFIX = 'enc:v1:aesgcm:'

const NOTE_KEY_STORAGE_PREFIX = 'promana-note-key:'

// In-memory fallback when localStorage is unavailable (private mode, SSR,
// Node tests). Keyed by uid.
const memoryKeyStore = new Map()

function getKeyStorageKey(uid) {
  return `${NOTE_KEY_STORAGE_PREFIX}${uid}`
}

function readStoredKeyMaterial(uid) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(getKeyStorageKey(uid))
    }
  } catch {
    // Storage blocked: fall through to memory store.
  }

  return memoryKeyStore.get(uid) ?? null
}

function writeStoredKeyMaterial(uid, material) {
  let storedInLocalStorage = false

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getKeyStorageKey(uid), material)
      storedInLocalStorage = true
    }
  } catch {
    // Storage blocked: memory fallback below.
  }

  if (!storedInLocalStorage) {
    memoryKeyStore.set(uid, material)
  }
}

export function clearCachedNoteKeys() {
  memoryKeyStore.clear()
}

export function getSubtleCrypto() {
  return globalThis.crypto?.subtle ?? null
}

export function isEncryptedNoteContent(value) {
  return (
    typeof value === 'string' && value.startsWith(ENCRYPTED_NOTE_PREFIX)
  )
}

export function hasNoteKey(uid) {
  if (!uid) {
    return false
  }

  return readStoredKeyMaterial(uid) != null
}

function bytesToBase64Url(bytes) {
  const NodeBuffer = globalThis.Buffer

  if (typeof NodeBuffer !== 'undefined') {
    return NodeBuffer.from(bytes).toString('base64url')
  }

  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value) {
  const normalized = String(value ?? '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const NodeBuffer = globalThis.Buffer

  if (typeof NodeBuffer !== 'undefined') {
    return new Uint8Array(NodeBuffer.from(normalized, 'base64'))
  }

  const binary = window.atob(normalized)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function importKeyFromMaterial(material) {
  const subtle = getSubtleCrypto()

  if (!subtle) {
    throw new Error('This browser cannot encrypt hidden notes.')
  }

  const raw = base64UrlToBytes(material)

  if (raw.length !== 32) {
    throw new Error('That encryption key is not valid.')
  }

  return subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

async function loadNoteKey(uid) {
  const material = readStoredKeyMaterial(uid)

  if (!material) {
    return null
  }

  try {
    return await importKeyFromMaterial(material)
  } catch {
    return null
  }
}

export async function getNoteKey(uid) {
  if (!uid) {
    return null
  }

  return loadNoteKey(uid)
}

export async function getOrCreateNoteKey(uid) {
  if (!uid) {
    throw new Error('You need to be signed in to encrypt hidden notes.')
  }

  const existing = await loadNoteKey(uid)

  if (existing) {
    return existing
  }

  const subtle = getSubtleCrypto()

  if (!subtle) {
    throw new Error('This browser cannot encrypt hidden notes.')
  }

  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const raw = new Uint8Array(await subtle.exportKey('raw', key))
  writeStoredKeyMaterial(uid, bytesToBase64Url(raw))

  return key
}

// Returns the raw key as a portable backup string (base64url of 32 bytes).
// The backup itself is as sensitive as the notes: treat it like a password.
export async function exportNoteKeyBackup(uid) {
  const key = await loadNoteKey(uid)

  if (!key) {
    throw new Error('No encryption key exists on this device yet.')
  }

  const subtle = getSubtleCrypto()

  if (!subtle) {
    throw new Error('This browser cannot export the encryption key.')
  }

  const raw = new Uint8Array(await subtle.exportKey('raw', key))
  return bytesToBase64Url(raw)
}

export async function importNoteKey(uid, backup) {
  if (!uid) {
    throw new Error('You need to be signed in to import an encryption key.')
  }

  const material = String(backup ?? '').trim()

  if (!material) {
    throw new Error('Paste an encryption key backup first.')
  }

  // Validates shape before storing so a typo cannot brick decryption.
  await importKeyFromMaterial(material)
  writeStoredKeyMaterial(uid, material)
}

export async function encryptNoteContent(plaintext, key) {
  const subtle = getSubtleCrypto()

  if (!subtle) {
    throw new Error('This browser cannot encrypt hidden notes.')
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(String(plaintext ?? ''))
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded),
  )

  return `${ENCRYPTED_NOTE_PREFIX}${bytesToBase64Url(iv)}:${bytesToBase64Url(ciphertext)}`
}

export async function decryptNoteContent(payload, key) {
  const subtle = getSubtleCrypto()

  if (!subtle) {
    throw new Error('This browser cannot decrypt hidden notes.')
  }

  if (!isEncryptedNoteContent(payload)) {
    throw new Error('That note is not encrypted.')
  }

  // Format is `enc:v1:aesgcm:<iv>:<ciphertext>`; base64url never contains
  // ':' so a plain split is safe.
  const parts = String(payload).split(':')

  if (parts.length !== 5) {
    throw new Error('That encrypted note is malformed.')
  }

  const iv = base64UrlToBytes(parts[3])
  const ciphertext = base64UrlToBytes(parts[4])

  try {
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new Error('That encrypted note could not be decrypted.')
  }
}

const DATABASE_NAME = 'promana-offline-transfer'
const DATABASE_VERSION = 1
const IMAGE_STORE = 'images'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000

function normalizeUid(uid) {
  const normalizedUid = String(uid ?? '').trim()

  if (!normalizedUid || normalizedUid.length > 128) {
    throw new Error('The offline image cache user is invalid.')
  }

  return normalizedUid
}

function getCacheKey(uid, driveFileId) {
  const normalizedUid = normalizeUid(uid)
  const normalizedFileId = String(driveFileId ?? '').trim()

  if (
    !normalizedUid ||
    normalizedUid.length > 128 ||
    !/^[a-zA-Z0-9_-]{10,256}$/.test(normalizedFileId)
  ) {
    throw new Error('The offline image cache key is invalid.')
  }

  return JSON.stringify([normalizedUid, normalizedFileId])
}

function openOfflineImageDatabase() {
  if (!window.indexedDB) {
    return Promise.reject(
      new Error('This browser does not support offline image storage.'),
    )
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result

      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        database.createObjectStore(IMAGE_STORE, { keyPath: 'key' })
      }
    })
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    })
    request.addEventListener(
      'error',
      () => reject(request.error || new Error('Offline storage could not open.')),
      { once: true },
    )
    request.addEventListener(
      'blocked',
      () => reject(new Error('Offline storage is blocked by another ProMana tab.')),
      { once: true },
    )
  })
}

function runStoreRequest(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, mode)
    const store = transaction.objectStore(IMAGE_STORE)
    let result

    try {
      result = operation(store)
    } catch (error) {
      reject(error)
      return
    }

    transaction.addEventListener('complete', () => resolve(result?.result), {
      once: true,
    })
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error || new Error('Offline storage was interrupted.')),
      { once: true },
    )
    transaction.addEventListener(
      'error',
      () => reject(transaction.error || new Error('Offline storage failed.')),
      { once: true },
    )
  })
}

export async function getCachedOfflineImage(uid, driveFileId) {
  const key = getCacheKey(uid, driveFileId)
  const database = await openOfflineImageDatabase()

  try {
    const record = await runStoreRequest(database, 'readonly', (store) =>
      store.get(key),
    )
    const isExpired = Number(record?.cachedAt) <= Date.now() - CACHE_TTL_MS

    if (
      !record ||
      record.uid !== uid ||
      record.driveFileId !== driveFileId ||
      !(record.blob instanceof Blob) ||
      record.blob.size <= 0 ||
      isExpired
    ) {
      if (record) {
        await runStoreRequest(database, 'readwrite', (store) =>
          store.delete(key),
        )
      }
      return null
    }

    return {
      blob: record.blob,
      filename: record.filename,
      mimeType: record.mimeType,
      cachedAt: record.cachedAt,
    }
  } finally {
    database.close()
  }
}

export async function cacheOfflineImage({
  uid,
  driveFileId,
  blob,
  filename,
  mimeType,
}) {
  const key = getCacheKey(uid, driveFileId)

  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('Only a non-empty image can be stored for offline use.')
  }

  const database = await openOfflineImageDatabase()

  try {
    await runStoreRequest(database, 'readwrite', (store) =>
      store.put({
        key,
        uid,
        driveFileId,
        blob,
        filename: String(filename ?? 'image').slice(0, 255),
        mimeType: String(mimeType || blob.type || '').slice(0, 100),
        size: blob.size,
        cachedAt: Date.now(),
      }),
    )
  } finally {
    database.close()
  }
}

export async function removeCachedOfflineImage(uid, driveFileId) {
  const key = getCacheKey(uid, driveFileId)
  const database = await openOfflineImageDatabase()

  try {
    await runStoreRequest(database, 'readwrite', (store) => store.delete(key))
  } finally {
    database.close()
  }
}

export async function clearCachedOfflineImages(uid) {
  const normalizedUid = normalizeUid(uid)
  const database = await openOfflineImageDatabase()

  try {
    await runStoreRequest(database, 'readwrite', (store) => {
      const request = store.openCursor()

      request.addEventListener('success', () => {
        const cursor = request.result
        if (!cursor) return

        if (cursor.value?.uid === normalizedUid) {
          cursor.delete()
        }
        cursor.continue()
      })

      return request
    })
  } finally {
    database.close()
  }
}

export const OFFLINE_IMAGE_CACHE_TTL_MS = CACHE_TTL_MS

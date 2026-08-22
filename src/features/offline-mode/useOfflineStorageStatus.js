import { useEffect, useState } from 'react'

const STORAGE_CHECK_DATABASE = 'promana-offline-storage-check'
const STORAGE_CHECK_TIMEOUT_MS = 3_000

function testIndexedDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is unavailable.'))
      return
    }

    const request = window.indexedDB.open(STORAGE_CHECK_DATABASE, 1)
    const timeoutId = window.setTimeout(() => {
      reject(new Error('IndexedDB did not respond.'))
    }, STORAGE_CHECK_TIMEOUT_MS)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains('capability')) {
        database.createObjectStore('capability')
      }
    })

    request.addEventListener('success', () => {
      window.clearTimeout(timeoutId)
      request.result.close()
      resolve()
    })

    request.addEventListener('error', () => {
      window.clearTimeout(timeoutId)
      reject(request.error || new Error('IndexedDB could not be opened.'))
    })

    request.addEventListener('blocked', () => {
      window.clearTimeout(timeoutId)
      reject(new Error('IndexedDB is blocked.'))
    })
  })
}

export default function useOfflineStorageStatus() {
  const [status, setStatus] = useState({
    isChecking: true,
    isAvailable: true,
    isPersistent: null,
  })

  useEffect(() => {
    let cancelled = false

    async function checkStorage() {
      try {
        await testIndexedDb()
        const isPersistent = navigator.storage?.persisted
          ? await navigator.storage.persisted().catch(() => null)
          : null

        if (!cancelled) {
          setStatus({
            isChecking: false,
            isAvailable: true,
            isPersistent,
          })
        }
      } catch {
        if (!cancelled) {
          setStatus({
            isChecking: false,
            isAvailable: false,
            isPersistent: false,
          })
        }
      }
    }

    void checkStorage()

    return () => {
      cancelled = true
    }
  }, [])

  return status
}

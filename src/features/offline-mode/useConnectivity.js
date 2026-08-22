import { useSyncExternalStore } from 'react'

export const CONNECTIVITY_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  RECONNECTING: 'reconnecting',
})

const CONNECTIVITY_URL = '/api/connectivity'
const CONNECTIVITY_HEADER = 'x-promana-connectivity'
const ONLINE_CHECK_INTERVAL_MS = 60_000
const OFFLINE_RETRY_INTERVAL_MS = 15_000
const PROBE_TIMEOUT_MS = 5_000

function initialSnapshot() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Object.freeze({
      status: CONNECTIVITY_STATUS.OFFLINE,
      lastCheckedAt: null,
      lastOnlineAt: null,
    })
  }

  return Object.freeze({
    status: CONNECTIVITY_STATUS.RECONNECTING,
    lastCheckedAt: null,
    lastOnlineAt: null,
  })
}

const serverSnapshot = Object.freeze({
  status: CONNECTIVITY_STATUS.RECONNECTING,
  lastCheckedAt: null,
  lastOnlineAt: null,
})

let snapshot = initialSnapshot()
let retryTimer = null
let activeRequest = null
let requestSequence = 0
let monitoring = false
const listeners = new Set()

function publish(nextSnapshot) {
  snapshot = Object.freeze(nextSnapshot)
  listeners.forEach((listener) => listener())
}

function clearRetryTimer() {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleNextProbe(delay) {
  clearRetryTimer()
  retryTimer = window.setTimeout(() => {
    void probeConnectivity()
  }, delay)
}

async function probeConnectivity({ announce = false } = {}) {
  if (typeof window === 'undefined') {
    return false
  }

  clearRetryTimer()
  activeRequest?.abort()

  const requestId = ++requestSequence
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  activeRequest = controller

  if (announce && snapshot.status !== CONNECTIVITY_STATUS.RECONNECTING) {
    publish({
      ...snapshot,
      status: CONNECTIVITY_STATUS.RECONNECTING,
    })
  }

  try {
    const separator = CONNECTIVITY_URL.includes('?') ? '&' : '?'
    const response = await fetch(
      `${CONNECTIVITY_URL}${separator}check=${Date.now()}`,
      {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      },
    )

    const isVerified =
      response.ok && response.headers.get(CONNECTIVITY_HEADER) === 'online'

    if (!isVerified) {
      throw new Error('Connectivity probe was not verified.')
    }

    if (requestId !== requestSequence) {
      return false
    }

    const checkedAt = Date.now()
    publish({
      status: CONNECTIVITY_STATUS.ONLINE,
      lastCheckedAt: checkedAt,
      lastOnlineAt: checkedAt,
    })
    scheduleNextProbe(ONLINE_CHECK_INTERVAL_MS)
    return true
  } catch {
    if (requestId !== requestSequence) {
      return false
    }

    publish({
      status: CONNECTIVITY_STATUS.OFFLINE,
      lastCheckedAt: Date.now(),
      lastOnlineAt: snapshot.lastOnlineAt,
    })
    scheduleNextProbe(OFFLINE_RETRY_INTERVAL_MS)
    return false
  } finally {
    window.clearTimeout(timeout)
    if (requestId === requestSequence) {
      activeRequest = null
    }
  }
}

function handleBrowserOffline() {
  activeRequest?.abort()
  publish({
    status: CONNECTIVITY_STATUS.OFFLINE,
    lastCheckedAt: Date.now(),
    lastOnlineAt: snapshot.lastOnlineAt,
  })
  scheduleNextProbe(OFFLINE_RETRY_INTERVAL_MS)
}

function handleBrowserOnline() {
  // navigator.onLine is only a hint. Do not report online until ProMana's
  // same-origin endpoint answers with the expected verification header.
  publish({
    ...snapshot,
    status: CONNECTIVITY_STATUS.RECONNECTING,
  })
  void probeConnectivity()
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void probeConnectivity({
      announce: snapshot.status !== CONNECTIVITY_STATUS.ONLINE,
    })
  }
}

function startMonitoring() {
  if (monitoring || typeof window === 'undefined') {
    return
  }

  monitoring = true
  window.addEventListener('online', handleBrowserOnline)
  window.addEventListener('offline', handleBrowserOffline)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void probeConnectivity({
    announce: navigator.onLine !== false,
  })
}

function stopMonitoring() {
  if (!monitoring || typeof window === 'undefined') {
    return
  }

  monitoring = false
  clearRetryTimer()
  activeRequest?.abort()
  activeRequest = null
  requestSequence += 1
  window.removeEventListener('online', handleBrowserOnline)
  window.removeEventListener('offline', handleBrowserOffline)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

function subscribe(listener) {
  listeners.add(listener)
  startMonitoring()

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stopMonitoring()
    }
  }
}

function getSnapshot() {
  return snapshot
}

// This read-only snapshot lets non-React helpers make a best-effort decision
// without reaching into the connectivity store's mutable internals.
export function getConnectivitySnapshot() {
  return snapshot
}

function getServerSnapshot() {
  return serverSnapshot
}

export function retryConnectivityCheck() {
  return probeConnectivity({ announce: true })
}

export default function useConnectivity() {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  return {
    ...current,
    isOnline: current.status === CONNECTIVITY_STATUS.ONLINE,
    isOffline: current.status === CONNECTIVITY_STATUS.OFFLINE,
    isReconnecting: current.status === CONNECTIVITY_STATUS.RECONNECTING,
    retry: retryConnectivityCheck,
  }
}

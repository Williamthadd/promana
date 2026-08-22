import { useSyncExternalStore } from 'react'
import {
  CONNECTIVITY_STATUS,
  getConnectivitySnapshot,
} from './useConnectivity.js'

const ONLINE_ACK_WAIT_MS = 500
const DEFAULT_DESCRIPTION = 'change'
const CONFIRMED_SNAPSHOTS_KEY = 'promana-offline-confirmed-snapshots'

const listeners = new Set()
const pendingOperations = new Map()
const snapshotReports = new Map()

function readConfirmedSnapshotCounts() {
  if (typeof window === 'undefined') {
    return new Map()
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CONFIRMED_SNAPSHOTS_KEY) || '{}',
    )

    return new Map(
      Object.entries(parsed)
        .filter(
          ([key, count]) =>
            typeof key === 'string' &&
            key.length <= 180 &&
            Number.isSafeInteger(count) &&
            count >= 0,
        )
        .slice(0, 100),
    )
  } catch {
    return new Map()
  }
}

const confirmedSnapshotCounts = readConfirmedSnapshotCounts()

let operationCounter = 0
let generation = 0
let lastSyncedAt = null
let syncError = null

const serverSnapshot = Object.freeze({
  pendingWrites: 0,
  hasPendingWrites: false,
  usingCachedData: false,
  missingCachedData: false,
  syncError: null,
  hasSyncError: false,
  lastSyncedAt: null,
})

let storeSnapshot = serverSnapshot

function normalizeDescription(description) {
  if (typeof description !== 'string') {
    return DEFAULT_DESCRIPTION
  }

  const normalized = description.trim().replace(/\s+/g, ' ')
  return normalized.slice(0, 80) || DEFAULT_DESCRIPTION
}

function normalizeError(error, description) {
  const code =
    typeof error?.code === 'string' ? error.code.slice(0, 100) : 'unknown'
  const message =
    typeof error?.message === 'string'
      ? error.message.slice(0, 240)
      : 'This change could not be synchronized.'

  return Object.freeze({
    code,
    message,
    description,
    occurredAt: Date.now(),
  })
}

function buildSnapshot() {
  const metadataPending = [...snapshotReports.values()].some(
    (metadata) => metadata.hasPendingWrites,
  )
  const usingCachedData = [...snapshotReports.values()].some(
    (metadata) => metadata.fromCache,
  )
  const missingCachedData = [...snapshotReports.values()].some(
    (metadata) =>
      metadata.fromCache &&
      !metadata.hasPendingWrites &&
      metadata.size === 0 &&
      (metadata.confirmedServerCount === null ||
        metadata.confirmedServerCount > 0),
  )
  const pendingWrites =
    pendingOperations.size > 0
      ? pendingOperations.size
      : metadataPending
        ? 1
        : 0

  return Object.freeze({
    pendingWrites,
    hasPendingWrites: pendingWrites > 0,
    usingCachedData,
    missingCachedData,
    syncError,
    hasSyncError: syncError !== null,
    lastSyncedAt,
  })
}

function publish() {
  storeSnapshot = buildSnapshot()
  listeners.forEach((listener) => listener())
}

function nextOperationId() {
  operationCounter += 1
  return `write-${Date.now()}-${operationCounter}`
}

function recordWriteSuccess(operationId, operationGeneration) {
  if (operationGeneration !== generation) {
    return
  }

  pendingOperations.delete(operationId)
  lastSyncedAt = Date.now()
  publish()
}

function recordWriteError(
  operationId,
  operationGeneration,
  error,
  description,
) {
  if (operationGeneration !== generation) {
    return
  }

  pendingOperations.delete(operationId)
  syncError = normalizeError(error, description)
  publish()
}

/**
 * Starts a Firestore write and gives the UI a bounded wait time.
 *
 * Firestore write promises remain pending while offline until the backend
 * acknowledges them. Returning `{ queued: true }` lets a modal close and show
 * an honest "saved locally" message while this store keeps observing the
 * original promise. `completion` always resolves to an outcome object, so an
 * ignored eventual rejection cannot become an unhandled promise rejection.
 */
export async function queueFirestoreWrite(write, description) {
  if (typeof write !== 'function') {
    throw new TypeError('queueFirestoreWrite requires a write function.')
  }

  const normalizedDescription = normalizeDescription(description)
  const operationId = nextOperationId()
  const operationGeneration = generation

  pendingOperations.set(operationId, {
    description: normalizedDescription,
    startedAt: Date.now(),
  })
  publish()

  let writePromise
  try {
    writePromise = Promise.resolve(write())
  } catch (error) {
    recordWriteError(
      operationId,
      operationGeneration,
      error,
      normalizedDescription,
    )
    throw error
  }

  const completion = writePromise.then(
    (value) => {
      recordWriteSuccess(operationId, operationGeneration)
      return { ok: true, value }
    },
    (error) => {
      recordWriteError(
        operationId,
        operationGeneration,
        error,
        normalizedDescription,
      )
      return { ok: false, error }
    },
  )

  if (
    getConnectivitySnapshot().status !== CONNECTIVITY_STATUS.ONLINE
  ) {
    return {
      queued: true,
      operationId,
      completion,
    }
  }

  let acknowledgementTimer
  const queuedResult = new Promise((resolve) => {
    acknowledgementTimer = setTimeout(
      () => resolve({ queued: true }),
      ONLINE_ACK_WAIT_MS,
    )
  })

  const firstResult = await Promise.race([completion, queuedResult])
  clearTimeout(acknowledgementTimer)

  if (firstResult.queued) {
    return {
      queued: true,
      operationId,
      completion,
    }
  }

  if (!firstResult.ok) {
    throw firstResult.error
  }

  return {
    queued: false,
    operationId,
    value: firstResult.value,
    completion,
  }
}

function persistConfirmedSnapshotCounts() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      CONFIRMED_SNAPSHOTS_KEY,
      JSON.stringify(Object.fromEntries(confirmedSnapshotCounts)),
    )
  } catch {
    // The marker improves empty-cache messaging but is not required for data
    // persistence itself.
  }
}

export function reportFirestoreSnapshot(key, metadata, details = {}) {
  if (typeof key !== 'string' || key.trim() === '') {
    return
  }

  const normalizedKey = key.trim().slice(0, 180)
  const size =
    Number.isSafeInteger(details.size) && details.size >= 0
      ? details.size
      : null

  if (
    metadata?.fromCache === false &&
    metadata?.hasPendingWrites === false &&
    size !== null
  ) {
    if (confirmedSnapshotCounts.get(normalizedKey) !== size) {
      confirmedSnapshotCounts.set(normalizedKey, size)
      persistConfirmedSnapshotCounts()
    }
  }

  snapshotReports.set(normalizedKey, {
    fromCache: metadata?.fromCache === true,
    hasPendingWrites: metadata?.hasPendingWrites === true,
    size,
    confirmedServerCount:
      confirmedSnapshotCounts.get(normalizedKey) ?? null,
  })

  if (
    metadata?.fromCache === false &&
    metadata?.hasPendingWrites === false
  ) {
    lastSyncedAt = Date.now()
  }

  publish()
}

export function removeFirestoreSnapshot(key) {
  if (
    typeof key === 'string' &&
    snapshotReports.delete(key.trim())
  ) {
    publish()
  }
}

export function dismissFirestoreSyncError() {
  if (syncError !== null) {
    syncError = null
    publish()
  }
}

export function resetFirestoreSyncStatus() {
  generation += 1
  pendingOperations.clear()
  snapshotReports.clear()
  lastSyncedAt = null
  syncError = null
  publish()
}

export function getFirestoreSyncSnapshot() {
  return storeSnapshot
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFirestoreSyncStatus() {
  const current = useSyncExternalStore(
    subscribe,
    getFirestoreSyncSnapshot,
    () => serverSnapshot,
  )

  return {
    ...current,
    dismissError: dismissFirestoreSyncError,
  }
}

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import connectivityHandler from '../api/connectivity.js'
import {
  dismissFirestoreSyncError,
  getFirestoreSyncSnapshot,
  queueFirestoreWrite,
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
  resetFirestoreSyncStatus,
} from '../src/features/offline-mode/firestoreSyncStore.js'

const FIRESTORE_HOOKS = [
  'useProjects.js',
  'useLaunchpad.js',
  'useNotes.js',
  'useTaskGroups.js',
  'useCalendarEntries.js',
  'useDocuments.js',
  'useDriveFolder.js',
  'useCustomEditors.js',
  'useUserLimits.js',
  'useAiDailyUsage.js',
]

function createResponse() {
  return {
    body: undefined,
    headers: new Map(),
    statusCode: 200,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value)
      return this
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
      return this
    },
    end(body) {
      this.body = body
      return this
    },
  }
}

test('connectivity endpoint is non-cacheable and supports GET and HEAD', () => {
  for (const method of ['GET', 'HEAD']) {
    const response = createResponse()
    connectivityHandler({ method }, response)

    assert.equal(response.statusCode, 204)
    assert.equal(response.headers.get('x-promana-connectivity'), 'online')
    assert.match(response.headers.get('cache-control'), /no-store/)
  }
})

test('connectivity endpoint rejects mutation methods', () => {
  const response = createResponse()
  connectivityHandler({ method: 'POST' }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(response.headers.get('allow'), 'GET, HEAD')
})

test('queued writes return promptly and remain tracked until acknowledgement', async () => {
  resetFirestoreSyncStatus()
  let resolveWrite
  const writePromise = new Promise((resolve) => {
    resolveWrite = resolve
  })

  const queued = await queueFirestoreWrite(() => writePromise, 'Offline note')
  assert.equal(queued.queued, true)
  assert.equal(getFirestoreSyncSnapshot().pendingWrites, 1)

  resolveWrite('saved')
  assert.deepEqual(await queued.completion, { ok: true, value: 'saved' })
  assert.equal(getFirestoreSyncSnapshot().pendingWrites, 0)
  assert.equal(typeof getFirestoreSyncSnapshot().lastSyncedAt, 'number')
})

test('eventual queued-write failures are captured without an unhandled rejection', async () => {
  resetFirestoreSyncStatus()
  const syncFailure = Object.assign(new Error('Permission denied'), {
    code: 'permission-denied',
  })
  const queued = await queueFirestoreWrite(
    () => Promise.reject(syncFailure),
    'Task update',
  )

  assert.equal(queued.queued, true)
  assert.deepEqual(await queued.completion, {
    ok: false,
    error: syncFailure,
  })
  assert.equal(getFirestoreSyncSnapshot().hasSyncError, true)
  assert.equal(
    getFirestoreSyncSnapshot().syncError.description,
    'Task update',
  )

  dismissFirestoreSyncError()
  assert.equal(getFirestoreSyncSnapshot().hasSyncError, false)
})

test('reset isolates a later account from an earlier queued write outcome', async () => {
  resetFirestoreSyncStatus()
  let rejectOldWrite
  const oldWrite = new Promise((_resolve, reject) => {
    rejectOldWrite = reject
  })
  const queued = await queueFirestoreWrite(() => oldWrite, 'Private note')

  resetFirestoreSyncStatus()
  rejectOldWrite(new Error('Old account rejection'))
  assert.equal((await queued.completion).ok, false)
  assert.equal(getFirestoreSyncSnapshot().pendingWrites, 0)
  assert.equal(getFirestoreSyncSnapshot().hasSyncError, false)
})

test('snapshot metadata reports cached data and pending writes', () => {
  resetFirestoreSyncStatus()
  reportFirestoreSnapshot('projects:user-1', {
    fromCache: true,
    hasPendingWrites: true,
  })

  assert.equal(getFirestoreSyncSnapshot().usingCachedData, true)
  assert.equal(getFirestoreSyncSnapshot().hasPendingWrites, true)

  removeFirestoreSnapshot('projects:user-1')
  assert.equal(getFirestoreSyncSnapshot().usingCachedData, false)
  assert.equal(getFirestoreSyncSnapshot().hasPendingWrites, false)
})

test('an empty offline snapshot is flagged until that source was server-confirmed', () => {
  resetFirestoreSyncStatus()
  reportFirestoreSnapshot(
    'never-loaded:user-1',
    { fromCache: true, hasPendingWrites: false },
    { size: 0 },
  )
  assert.equal(getFirestoreSyncSnapshot().missingCachedData, true)

  reportFirestoreSnapshot(
    'never-loaded:user-1',
    { fromCache: false, hasPendingWrites: false },
    { size: 0 },
  )
  assert.equal(getFirestoreSyncSnapshot().missingCachedData, false)
  removeFirestoreSnapshot('never-loaded:user-1')
})

test('Firestore and every dashboard listener retain persistent-cache metadata', async () => {
  const firebaseSource = await readFile(
    new URL('../src/firebase.js', import.meta.url),
    'utf8',
  )

  assert.match(firebaseSource, /initializeFirestore\(app/)
  assert.match(firebaseSource, /persistentLocalCache\(/)
  assert.match(firebaseSource, /persistentMultipleTabManager\(/)

  const hookSources = await Promise.all(
    FIRESTORE_HOOKS.map((fileName) =>
      readFile(new URL(`../src/hooks/${fileName}`, import.meta.url), 'utf8'),
    ),
  )

  for (const [index, source] of hookSources.entries()) {
    assert.match(
      source,
      /includeMetadataChanges:\s*true/,
      `${FIRESTORE_HOOKS[index]} must observe cache/pending metadata`,
    )
    assert.match(
      source,
      /reportFirestoreSnapshot\(/,
      `${FIRESTORE_HOOKS[index]} must report cache state`,
    )
    assert.match(
      source,
      /size:\s*(snapshot\.size|snapshot\.exists\(\) \? 1 : 0)/,
      `${FIRESTORE_HOOKS[index]} must identify an empty cache result`,
    )
  }
})

test('sync state is isolated when the authenticated user changes or logs out', async () => {
  const [dashboardSource, headerSource] = await Promise.all([
    readFile(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Header.jsx', import.meta.url), 'utf8'),
  ])

  assert.match(dashboardSource, /resetFirestoreSyncStatus\(\)/)
  assert.match(dashboardSource, /syncUserIdRef\.current !== nextUserId/)
  assert.match(headerSource, /resetFirestoreSyncStatus\(\)/)
})

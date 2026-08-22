import { useEffect, useState } from 'react'
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from '../features/offline-mode/firestoreSyncStore'
import {
  CONNECTIVITY_STATUS,
  getConnectivitySnapshot,
} from '../features/offline-mode/useConnectivity'

const AI_USAGE_DOCUMENT_ID = 'aiDaily'

export function getAiUsageDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeCount(value) {
  const count = Number(value)

  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

function createDailyLimitError() {
  const error = new Error('Daily AI limit reached.')
  error.code = 'ai/daily-limit'
  return error
}

function createOfflineError() {
  const error = new Error(
    'Ask AI needs an internet connection. Your cached workspace is still available offline.',
  )
  error.code = 'ai/offline'
  return error
}

export default function useAiDailyUsage(uid, dailyLimit) {
  const safeDailyLimit = Math.max(1, normalizeCount(dailyLimit))
  const [dateKey, setDateKey] = useState(() => getAiUsageDateKey())
  const [state, setState] = useState(() => ({
    uid,
    dateKey,
    creditsUsed: 0,
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    const dateCheckInterval = window.setInterval(() => {
      const nextDateKey = getAiUsageDateKey()
      setDateKey((currentDateKey) =>
        currentDateKey === nextDateKey ? currentDateKey : nextDateKey,
      )
    }, 60_000)

    return () => window.clearInterval(dateCheckInterval)
  }, [])

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const usageReference = doc(
      db,
      'users',
      uid,
      'usage',
      AI_USAGE_DOCUMENT_ID,
    )

    const snapshotKey = `ai-usage:${uid}`
    const unsubscribe = onSnapshot(
      usageReference,
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.exists() ? 1 : 0,
        })
        const usage = snapshot.data()
        const creditsUsed =
          usage?.dateKey === dateKey ? normalizeCount(usage.count) : 0

        setState({
          uid,
          dateKey,
          creditsUsed,
          loading: false,
          error: null,
        })
      },
      (error) => {
        setState((currentState) => ({
          uid,
          dateKey,
          creditsUsed:
            currentState.uid === uid ? currentState.creditsUsed : 0,
          loading: false,
          error,
        }))
      },
    )

    return () => {
      unsubscribe()
      removeFirestoreSnapshot(snapshotKey)
    }
  }, [dateKey, uid])

  async function consumeCredit() {
    if (!uid) {
      const error = new Error('Authentication is required to use AI.')
      error.code = 'ai/auth-required'
      throw error
    }

    // Firestore transactions cannot run offline. Checking the shared,
    // same-origin connectivity state here prevents callers from accidentally
    // starting a transaction that would otherwise fail or wait on the network.
    if (
      getConnectivitySnapshot().status !== CONNECTIVITY_STATUS.ONLINE
    ) {
      throw createOfflineError()
    }

    const activeDateKey = getAiUsageDateKey()
    const usageReference = doc(
      db,
      'users',
      uid,
      'usage',
      AI_USAGE_DOCUMENT_ID,
    )

    const nextCount = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(usageReference)
      const usage = snapshot.data()
      const currentCount =
        usage?.dateKey === activeDateKey ? normalizeCount(usage.count) : 0

      if (currentCount >= safeDailyLimit) {
        throw createDailyLimitError()
      }

      const count = currentCount + 1
      const timestamp = serverTimestamp()
      const nextUsage = {
        dateKey: activeDateKey,
        count,
        dailyLimit: safeDailyLimit,
        timeZone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        updatedAt: timestamp,
      }

      if (!snapshot.exists()) {
        nextUsage.createdAt = timestamp
      }

      transaction.set(usageReference, nextUsage, { merge: true })
      return count
    })

    setDateKey(activeDateKey)
    setState({
      uid,
      dateKey: activeDateKey,
      creditsUsed: nextCount,
      loading: false,
      error: null,
    })

    return nextCount
  }

  if (!uid) {
    return {
      creditsUsed: 0,
      loading: false,
      error: null,
      consumeCredit,
    }
  }

  const isCurrentState = state.uid === uid && state.dateKey === dateKey

  return {
    creditsUsed: isCurrentState ? state.creditsUsed : 0,
    loading: isCurrentState ? state.loading : true,
    error: isCurrentState ? state.error : null,
    consumeCredit,
  }
}

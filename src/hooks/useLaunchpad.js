import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from '../features/offline-mode/firestoreSyncStore'
import { getTimeValue } from '../utils/formatters'

function sortLaunchpadItems(items) {
  return [...items].sort((left, right) => {
    if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
      return left.isPinned ? -1 : 1
    }

    const orderDiff = Number(left.order ?? 0) - Number(right.order ?? 0)

    if (orderDiff !== 0) {
      return orderDiff
    }

    return getTimeValue(right.createdAt) - getTimeValue(left.createdAt)
  })
}

export default function useLaunchpad() {
  const uid = auth.currentUser?.uid ?? null
  const [state, setState] = useState(() => ({
    uid,
    items: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const launchpadQuery = query(
      collection(db, 'users', uid, 'launchpad'),
      orderBy('createdAt', 'desc'),
    )

    const snapshotKey = `launchpad:${uid}`
    const unsubscribe = onSnapshot(
      launchpadQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.size,
        })
        const nextItems = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }))

        setState({
          uid,
          items: sortLaunchpadItems(nextItems),
          loading: false,
          error: null,
        })
      },
      (nextError) => {
        setState((currentState) => ({
          uid,
          items: currentState.uid === uid ? currentState.items : [],
          loading: false,
          error: nextError,
        }))
      },
    )

    return () => {
      unsubscribe()
      removeFirestoreSnapshot(snapshotKey)
    }
  }, [uid])

  if (!uid) {
    return { items: [], loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    items: isCurrentUserState ? state.items : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}

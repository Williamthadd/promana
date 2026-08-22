import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import {
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from '../features/offline-mode/firestoreSyncStore'
import { getTimeValue } from '../utils/formatters'

function sortDocuments(documents) {
  return [...documents].sort(
    (left, right) =>
      getTimeValue(right.lastUpdatedAt) - getTimeValue(left.lastUpdatedAt),
  )
}

export default function useDocuments(uid) {
  const [state, setState] = useState(() => ({
    uid,
    documents: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const snapshotKey = `documents:${uid}`
    const unsubscribe = onSnapshot(
      collection(db, 'users', uid, 'documents'),
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.size,
        })
        setState({
          uid,
          documents: sortDocuments(
            snapshot.docs.map((documentSnapshot) => ({
              id: documentSnapshot.id,
              ...documentSnapshot.data(),
            })),
          ),
          loading: false,
          error: null,
        })
      },
      (error) => {
        setState((currentState) => ({
          uid,
          documents:
            currentState.uid === uid ? currentState.documents : [],
          loading: false,
          error,
        }))
      },
    )

    return () => {
      unsubscribe()
      removeFirestoreSnapshot(snapshotKey)
    }
  }, [uid])

  if (!uid) {
    return { documents: [], loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    documents: isCurrentUserState ? state.documents : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}

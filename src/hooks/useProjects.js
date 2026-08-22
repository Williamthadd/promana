import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import {
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from '../features/offline-mode/firestoreSyncStore'
import { getTimeValue } from '../utils/formatters'

function sortProjects(projects) {
  return [...projects].sort((left, right) => {
    if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
      return left.isPinned ? -1 : 1
    }

    return getTimeValue(right.lastUpdatedAt) - getTimeValue(left.lastUpdatedAt)
  })
}

export default function useProjects(uid) {
  const [state, setState] = useState(() => ({
    uid,
    projects: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const snapshotKey = `projects:${uid}`
    const unsubscribe = onSnapshot(
      collection(db, 'users', uid, 'projects'),
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.size,
        })
        const nextProjects = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }))

        setState({
          uid,
          projects: sortProjects(nextProjects),
          error: null,
          loading: false,
        })
      },
      (nextError) => {
        setState((currentState) => ({
          uid,
          projects: currentState.uid === uid ? currentState.projects : [],
          error: nextError,
          loading: false,
        }))
      },
    )

    return () => {
      unsubscribe()
      removeFirestoreSnapshot(snapshotKey)
    }
  }, [uid])

  if (!uid) {
    return { projects: [], loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    projects: isCurrentUserState ? state.projects : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}

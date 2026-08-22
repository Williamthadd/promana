import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import {
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from '../features/offline-mode/firestoreSyncStore'

export default function useDriveFolder(uid) {
  const [state, setState] = useState(() => ({
    uid,
    folderId: '',
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const snapshotKey = `drive-folder:${uid}`
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid, 'settings', 'googleDrive'),
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.exists() ? 1 : 0,
        })
        setState({
          uid,
          folderId: String(snapshot.data()?.folderId ?? '').trim(),
          loading: false,
          error: null,
        })
      },
      (error) => {
        setState((currentState) => ({
          uid,
          folderId: currentState.uid === uid ? currentState.folderId : '',
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
    return { folderId: '', loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    folderId: isCurrentUserState ? state.folderId : '',
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}

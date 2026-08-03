import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

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

    return onSnapshot(
      doc(db, 'users', uid, 'settings', 'googleDrive'),
      (snapshot) => {
        setState({
          uid,
          folderId: String(snapshot.data()?.folderId ?? '').trim(),
          loading: false,
          error: null,
        })
      },
      (error) => {
        setState({ uid, folderId: '', loading: false, error })
      },
    )
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

import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore'
import { normalizeCustomEditor } from '../constants/editorSchemes'
import { db } from '../firebase'
import {
  queueFirestoreWrite,
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from '../features/offline-mode/firestoreSyncStore'

function normalizeCustomEditors(editors = []) {
  const normalizedEditors = editors
    .map((editor, index) => normalizeCustomEditor(editor, `custom-editor-${index}`))
    .filter(Boolean)

  return Array.from(
    new Map(normalizedEditors.map((editor) => [editor.scheme, editor])).values(),
  )
}

export default function useCustomEditors(uid) {
  const [state, setState] = useState(() => ({
    uid,
    editors: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const editorsRef = doc(db, 'users', uid, 'settings', 'editors')
    const snapshotKey = `custom-editors:${uid}`
    const unsubscribe = onSnapshot(
      editorsRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.exists() ? 1 : 0,
        })
        setState({
          uid,
          editors: normalizeCustomEditors(snapshot.data()?.customEditors),
          loading: false,
          error: null,
        })
      },
      (error) => {
        setState((currentState) => ({
          uid,
          editors: currentState.uid === uid ? currentState.editors : [],
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

  async function saveCustomEditors(editors) {
    if (!uid) {
      throw new Error('You need to be signed in to manage IDEs.')
    }

    const normalizedEditors = normalizeCustomEditors(editors)

    const writeResult = await queueFirestoreWrite(
      () =>
        setDoc(
          doc(db, 'users', uid, 'settings', 'editors'),
          {
            customEditors: normalizedEditors.map(({ id, name, scheme }) => ({
              id,
              name,
              scheme,
            })),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        ),
      'Project IDE settings',
    )

    return {
      editors: normalizedEditors,
      queued: writeResult.queued,
    }
  }

  if (!uid) {
    return {
      editors: [],
      loading: false,
      error: null,
      saveCustomEditors,
    }
  }

  const isCurrentUserState = state.uid === uid

  return {
    editors: isCurrentUserState ? state.editors : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
    saveCustomEditors,
  }
}

import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore'
import { normalizeCustomEditor } from '../constants/editorSchemes'
import { db } from '../firebase'

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
    const unsubscribe = onSnapshot(
      editorsRef,
      (snapshot) => {
        setState({
          uid,
          editors: normalizeCustomEditors(snapshot.data()?.customEditors),
          loading: false,
          error: null,
        })
      },
      (error) => {
        setState({ uid, editors: [], loading: false, error })
      },
    )

    return unsubscribe
  }, [uid])

  async function saveCustomEditors(editors) {
    if (!uid) {
      throw new Error('You need to be signed in to manage IDEs.')
    }

    const normalizedEditors = normalizeCustomEditors(editors)

    await setDoc(
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
    )

    return normalizedEditors
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

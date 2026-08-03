import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
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

    return onSnapshot(
      collection(db, 'users', uid, 'documents'),
      (snapshot) => {
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
        setState({
          uid,
          documents: [],
          loading: false,
          error,
        })
      },
    )
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

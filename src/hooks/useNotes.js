import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../firebase"
import { getTimeValue } from "../utils/formatters"

function sortNotes(notes) {
  return [...notes].sort((left, right) => {
    if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
      return left.isPinned ? -1 : 1
    }

    return getTimeValue(right.lastUpdatedAt) - getTimeValue(left.lastUpdatedAt)
  })
}

export default function useNotes(uid) {
  const [state, setState] = useState(() => ({
    uid,
    notes: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const unsubscribe = onSnapshot(
      collection(db, "users", uid, "notes"),
      (snapshot) => {
        const nextNotes = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }))

        setState({
          uid,
          notes: sortNotes(nextNotes),
          error: null,
          loading: false,
        })
      },
      (nextError) => {
        setState({
          uid,
          notes: [],
          error: nextError,
          loading: false,
        })
      },
    )

    return unsubscribe
  }, [uid])

  if (!uid) {
    return { notes: [], loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    notes: isCurrentUserState ? state.notes : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}

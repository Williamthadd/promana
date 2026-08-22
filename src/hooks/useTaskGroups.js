import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../firebase"
import {
  removeFirestoreSnapshot,
  reportFirestoreSnapshot,
} from "../features/offline-mode/firestoreSyncStore"
import { getTimeValue } from "../utils/formatters"
import { normalizeTaskItems } from "../utils/taskUtils"

function sortTaskGroups(taskGroups) {
  return [...taskGroups].sort((left, right) => {
    if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
      return left.isPinned ? -1 : 1
    }

    return getTimeValue(right.lastUpdatedAt) - getTimeValue(left.lastUpdatedAt)
  })
}

export default function useTaskGroups(uid) {
  const [state, setState] = useState(() => ({
    uid,
    taskGroups: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const snapshotKey = `task-groups:${uid}`
    const unsubscribe = onSnapshot(
      collection(db, "users", uid, "taskGroups"),
      { includeMetadataChanges: true },
      (snapshot) => {
        reportFirestoreSnapshot(snapshotKey, snapshot.metadata, {
          size: snapshot.size,
        })
        const nextTaskGroups = snapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data()

          return {
            id: documentSnapshot.id,
            ...data,
            isPinned: Boolean(data.isPinned),
            tags: Array.isArray(data.tags) ? data.tags : [],
            tasks: normalizeTaskItems(data.tasks),
          }
        })

        setState({
          uid,
          taskGroups: sortTaskGroups(nextTaskGroups),
          error: null,
          loading: false,
        })
      },
      (nextError) => {
        setState((currentState) => ({
          uid,
          taskGroups:
            currentState.uid === uid ? currentState.taskGroups : [],
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
    return { taskGroups: [], loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    taskGroups: isCurrentUserState ? state.taskGroups : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}
